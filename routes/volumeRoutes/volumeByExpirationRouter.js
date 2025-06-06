const express = require('express');
const axios = require('axios');
const pool = require('../../cmd/db');
const router = express.Router();

let conversionCache = {};
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour cache

const getTableName = (exchange, asset) => {
	const exchangeTables = {
		OKX: {
			btc: 'okx_btc_trades',
			eth: 'okx_eth_trades',
		},
		DER: {
			btc: 'all_btc_trades',
			eth: 'all_eth_trades',
		},
	};

	return exchangeTables[exchange]?.[asset.toLowerCase()] || null;
};

// Function to fetch conversion rate with retry logic and exponential backoff
async function getConversionRate(assetSymbol) {
	const cacheKey = `conversionRate_${assetSymbol}`;
	const now = Date.now();
	const maxRetries = 3;

	// Use cache if recent
	if (conversionCache[cacheKey] && now - conversionCache[cacheKey].timestamp < CACHE_EXPIRY) {
		return conversionCache[cacheKey].rate;
	}

	// Define the URL based on asset
	const url =
		assetSymbol === 'btc'
			? 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
			: 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

	let attempt = 0;
	while (attempt < maxRetries) {
		try {
			const response = await axios.get(url);
			const conversionRate = assetSymbol === 'btc' ? response.data.bitcoin.usd : response.data.ethereum.usd;

			// Cache the fetched rate
			conversionCache[cacheKey] = {
				rate: conversionRate,
				timestamp: now,
			};

			return conversionRate;
		} catch (error) {
			if (error.response && error.response.status === 429) {
				attempt += 1;
				const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
				console.warn(`Rate limit hit, retrying in ${delay / 1000} seconds...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
			} else {
				throw error; // If not a rate limit error, rethrow it
			}
		}
	}

	throw new Error('Failed to fetch conversion rate after multiple retries');
}

const convertToISODate = (dateStr) => {
	const year = `20${dateStr.slice(-2)}`;
	const monthStr = dateStr.slice(-5, -2).toUpperCase();
	let day = dateStr.slice(0, dateStr.length - 5);

	const monthMap = {
		JAN: '01',
		FEB: '02',
		MAR: '03',
		APR: '04',
		MAY: '05',
		JUN: '06',
		JUL: '07',
		AUG: '08',
		SEP: '09',
		OCT: '10',
		NOV: '11',
		DEC: '12',
	};

	const month = monthMap[monthStr];
	if (!month) {
		console.error(`Error: could not find month for string: ${dateStr}`);
		return null;
	}

	if (day.length === 1) {
		day = `0${day}`;
	}

	return `${year}-${month}-${day}`;
};

router.get('/open-interest-by-expiration/:asset/:strike', async (req, res) => {
	const { asset, strike } = req.params;
	const { exchange } = req.query;

	const assetSymbol = asset.toLowerCase() === 'btc' ? 'bitcoin' : 'ethereum';
	const tableName = getTableName(exchange, asset);
	if (!tableName) {
		console.error('Invalid exchange or asset specified');
		return res.status(400).json({ message: 'Invalid exchange or asset specified' });
	}

	try {
		// Get conversion rate with fallback rate in case of failure
		let conversionRate;
		try {
			conversionRate = await getConversionRate(assetSymbol);
		} catch (error) {
			console.warn('Using fallback rate due to conversion rate fetch failure');
			conversionRate = conversionCache[assetSymbol]?.rate || 1; // Use last cached rate or default to 1
		}

		const strikeCondition = strike === 'all' ? '' : `AND instrument_name LIKE '%-${strike}-%'`;
		const contractField = exchange === 'OKX' ? 'amount' : 'contracts';

		const result = await pool.query(`
            SELECT
                instrument_name,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN ${contractField} ELSE 0 END) AS puts_otm,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN ${contractField} ELSE 0 END) AS calls_otm,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN ${contractField} * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN ${contractField} * mark_price ELSE 0 END) AS calls_market_value,
                SUM(${contractField} * mark_price) AS notional_value
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ${strikeCondition}
            GROUP BY instrument_name
            ORDER BY instrument_name;
        `);

		const groupedData = {};

		result.rows.forEach((row) => {
			const match = row.instrument_name.match(/(\d{1,2}[A-Z]{3}\d{2})/);
			const expirationDate = match ? match[1] : null;
			if (expirationDate) {
				if (!groupedData[expirationDate]) {
					groupedData[expirationDate] = {
						puts_otm: 0,
						calls_otm: 0,
						puts_market_value: 0,
						calls_market_value: 0,
						notional_value: 0,
					};
				}

				groupedData[expirationDate].puts_otm += parseFloat(row.puts_otm);
				groupedData[expirationDate].calls_otm += parseFloat(row.calls_otm);
				groupedData[expirationDate].puts_market_value += parseFloat(row.puts_market_value) * conversionRate;
				groupedData[expirationDate].calls_market_value += parseFloat(row.calls_market_value) * conversionRate;
				groupedData[expirationDate].notional_value += parseFloat(row.notional_value) * conversionRate;
			}
		});

		Object.keys(groupedData).forEach((expiration) => {
			groupedData[expiration].puts_otm = groupedData[expiration].puts_otm.toFixed(2);
			groupedData[expiration].calls_otm = groupedData[expiration].calls_otm.toFixed(2);
			groupedData[expiration].puts_market_value = groupedData[expiration].puts_market_value.toFixed(2);
			groupedData[expiration].calls_market_value = groupedData[expiration].calls_market_value.toFixed(2);
			groupedData[expiration].notional_value = groupedData[expiration].notional_value.toFixed(2);
		});

		const sortedGroupedData = Object.keys(groupedData)
			.sort((a, b) => new Date(convertToISODate(a)) - new Date(convertToISODate(b)))
			.reduce((sortedObj, key) => {
				sortedObj[key] = groupedData[key];
				return sortedObj;
			}, {});

		res.json(sortedGroupedData);
	} catch (error) {
		console.error('Error fetching open interest by expiration:', error.message);
		res.status(500).json({ message: 'Failed to fetch open interest data', error });
	}
});

module.exports = router;
