const express = require('express');
const pool = require('../../config/database');
const axios = require('axios');
const router = express.Router();

let cache = {};
const CACHE_EXPIRY = 300000;

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

async function getConversionRate(asset) {
    const cacheKey = `conversionRate_${asset}`;

    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_EXPIRY)) {
        return cache[cacheKey].rate;
    }

    const url = asset.toLowerCase() === 'btc'
        ? 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
        : 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

    const response = await axios.get(url);
    const rate = asset.toLowerCase() === 'btc'
        ? response.data.bitcoin.usd
        : response.data.ethereum.usd;

    cache[cacheKey] = {
        rate,
        timestamp: Date.now(),
    };

    return rate;
}

router.get('/open-interest-by-strike/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;
    const { exchange } = req.query;

    // Include exchange in cache key
    const cacheKey = `openInterest_${asset}_${expiration}_${exchange}`;
    try {
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_EXPIRY)) {
            return res.json(cache[cacheKey].data);
        }

        const conversionRate = await getConversionRate(asset);

        const tableName = getTableName(exchange, asset);
        if (!tableName) {
            console.error('Invalid exchange or asset specified');
            return res.status(400).json({ message: 'Invalid exchange or asset specified' });
        }

        // Choose field based on the exchange
        const contractField = exchange === 'OKX' ? 'amount' : 'contracts';
        const expirationCondition = expiration === 'all' ? '' : `AND instrument_name LIKE '%${expiration}%'`;

        const query = `
            SELECT 
                CAST(SUBSTRING(instrument_name FROM '-([0-9]+)-[PC]$') AS INTEGER) AS strike,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN ${contractField} ELSE 0 END) AS puts,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN ${contractField} ELSE 0 END) AS calls,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN ${contractField} * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN ${contractField} * mark_price ELSE 0 END) AS calls_market_value
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ${expirationCondition}
            GROUP BY strike
            ORDER BY strike;
        `;

        const result = await pool.query(query);

        const data = result.rows.map(row => ({
            strike: row.strike,
            puts: row.puts,
            calls: row.calls,
            puts_market_value: (row.puts_market_value * conversionRate).toFixed(2),
            calls_market_value: (row.calls_market_value * conversionRate).toFixed(2),
        }));

        cache[cacheKey] = {
            data,
            timestamp: Date.now(),
        };

        res.json(data);
    } catch (error) {
        console.error(`Error fetching open interest by strike for ${asset}:`, error);
        res.status(500).json({ message: 'Failed to fetch open interest data', error });
    }
});

module.exports = router;
