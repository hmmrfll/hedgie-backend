const express = require('express');
const pool = require('../../cmd/db');
const moment = require('moment');
const router = express.Router();

const calculateDTE = (instrumentName) => {
	const expDate = instrumentName.split('-')[1];
	const expDateFormatted = moment(expDate, 'DDMMMYY');
	const now = moment();
	const dte = expDateFormatted.diff(now, 'days');
	return dte >= 0 ? `${dte}d` : '0d';
};

const determineMaker = (premium) => {
	if (premium < 250) return '🐙🦑';
	if (premium < 1000) return '🐟🎣';
	if (premium < 10000) return '🐡🚣';
	if (premium < 100000) return '🐬🌊';
	if (premium < 1000000) return '🐋🐳';
	if (premium < 10000000) return '🦈';
	return 'Unknown';
};

router.get('/trades', async (req, res) => {
	const {
		asset = 'ALL',
		side = 'ALL',
		optionType = 'ALL',
		minStrike,
		maxStrike,
		ivMin,
		ivMax,
		dteMin,
		dteMax,
		maker,
		page = 1,
		pageSize = 15,
	} = req.query;

	const parsedPageSize = parseInt(pageSize, 10) || 15;
	const parsedPage = parseInt(page, 10) || 1;
	const offset = (parsedPage - 1) * parsedPageSize;

	try {
		let query = `
            SELECT
                block_trade_id,
                TO_CHAR(timestamp, 'HH24:MI:SS') AS timeUtc,
                direction AS side,
                instrument_name,
                RIGHT(instrument_name, 1) AS k,
                TO_CHAR(timestamp, 'YYYY-MM-DD') AS chain,
                index_price AS spot,
                amount AS size,
                price,
                iv,
                mark_price,  -- Добавлено поле для mark_price
                TO_DATE(SUBSTRING(instrument_name FROM '\\d+[A-Z]{3}\\d{2}'), 'DDMONYY') AS expiration_date,
                'Deribit' AS exchange
            FROM
                ${
									asset === 'ALL'
										? '(SELECT * FROM eth_block_trades UNION SELECT * FROM btc_block_trades) AS combined_trades'
										: asset.toLowerCase() + '_block_trades'
								}
            WHERE 1=1
        `;

		// Добавление фильтров в запрос (аналогично оригиналу)
		if (optionType !== 'ALL') {
			query += ` AND RIGHT(instrument_name, 1) = '${optionType}'`;
		}
		if (minStrike) {
			query += ` AND CAST(REGEXP_SUBSTR(instrument_name, '\\d+(?=-[CP]$)') AS INTEGER) >= ${minStrike}`;
		}
		if (maxStrike) {
			query += ` AND CAST(REGEXP_SUBSTR(instrument_name, '\\d+(?=-[CP]$)') AS INTEGER) <= ${maxStrike}`;
		}
		if (ivMin) {
			query += ` AND iv >= ${ivMin}`;
		}
		if (ivMax) {
			query += ` AND iv <= ${ivMax}`;
		}
		if (dteMin) {
			query += ` AND (TO_DATE(SUBSTRING(instrument_name FROM '\\d+[A-Z]{3}\\d{2}'), 'DDMONYY') - CURRENT_DATE) >= ${dteMin}`;
		}
		if (dteMax) {
			query += ` AND (TO_DATE(SUBSTRING(instrument_name FROM '\\d+[A-Z]{3}\\d{2}'), 'DDMONYY') - CURRENT_DATE) <= ${dteMax}`;
		}
		if (side !== 'ALL') {
			query += ` AND direction = '${side.toLowerCase()}'`;
		}

		query += ` ORDER BY timestamp DESC`;

		const tradesResult = await pool.query(query);

		const groupedTrades = tradesResult.rows.reduce((acc, trade) => {
			const strike = trade.instrument_name.match(/\d+(?=-[CP]$)/);
			const dte = calculateDTE(trade.instrument_name);

			const priceInUSD = (parseFloat(trade.price) * parseFloat(trade.spot)).toFixed(2);
			const premiumInUSD = (parseFloat(trade.price) * parseFloat(trade.size) * parseFloat(trade.spot)).toFixed(2);

			const premiumInBaseAsset = trade.price && trade.spot ? (parseFloat(trade.price) / trade.spot).toFixed(4) : 'N/A'; // Премиум в базовом активе
			const markPrice = trade.mark_price || 'N/A'; // Используем mark_price или 'N/A'

			const makerCalculated = determineMaker(parseFloat(premiumInUSD));

			const enhancedTrade = {
				...trade,
				strike: strike ? strike[0] : null,
				dte,
				price: priceInUSD,
				premium: premiumInUSD,
				premiumInBaseAsset, // Добавляем премиум в базовом активе
				markPrice, // Добавляем mark_price
				maker: makerCalculated,
			};

			if (maker && maker !== 'ALL' && enhancedTrade.maker !== maker) {
				return acc;
			}

			if (!acc[trade.block_trade_id]) {
				acc[trade.block_trade_id] = [];
			}
			acc[trade.block_trade_id].push(enhancedTrade);

			return acc;
		}, {});

		const groupedArray = Object.entries(groupedTrades).map(([blockTradeId, trades]) => ({
			blockTradeId,
			trades,
		}));

		const totalRows = groupedArray.length;
		const totalPages = Math.ceil(totalRows / parsedPageSize);
		const paginatedGroups = groupedArray.slice(offset, offset + parsedPageSize);

		res.json({
			groupedTrades: paginatedGroups,
			totalPages,
		});
	} catch (error) {
		console.error('Error fetching trades:', error);
		res.status(500).send('Error fetching trades');
	}
});

module.exports = router;
