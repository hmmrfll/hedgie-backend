const express = require('express');
const pool = require('../../config/database');
const axios = require('axios');
const router = express.Router();

let cachedRate = null;
let lastFetchedTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

// Определяем таблицу в зависимости от биржи и актива
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

    const lowerCaseAsset = asset.toLowerCase();
    return exchangeTables[exchange]?.[lowerCaseAsset] || null;
};

async function getConversionRate(asset) {
    const now = Date.now();

    if (cachedRate && (now - lastFetchedTime) < CACHE_TTL) {
        return cachedRate[asset.toLowerCase()];
    }

    const btcUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
    const ethUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

    const [btcResponse, ethResponse] = await Promise.all([
        axios.get(btcUrl),
        axios.get(ethUrl)
    ]);

    cachedRate = {
        btc: btcResponse.data.bitcoin.usd,
        eth: ethResponse.data.ethereum.usd
    };
    lastFetchedTime = now;

    return cachedRate[asset.toLowerCase()];
}

router.get('/open-interest-by-strike/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;
    const { exchange } = req.query;

    const tableName = getTableName(exchange, asset);
    if (!tableName) {
        console.error('Invalid exchange or asset specified');
        return res.status(400).json({ message: 'Invalid exchange or asset specified' });
    }

    try {
        const conversionRate = await getConversionRate(asset);

        const expirationCondition = expiration === 'all' ? '' : `WHERE instrument_name LIKE '%${expiration}%'`;

        // Определяем поле количества контрактов в зависимости от биржи
        const contractField = exchange === 'OKX' ? 'amount' : 'contracts';

        const query = `
            SELECT 
                CAST(SUBSTRING(instrument_name FROM '-([0-9]+)-[PC]$') AS INTEGER) AS strike,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN ${contractField} ELSE 0 END) AS puts,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN ${contractField} ELSE 0 END) AS calls,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN ${contractField} * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN ${contractField} * mark_price ELSE 0 END) AS calls_market_value
            FROM ${tableName}
            ${expirationCondition} -- Условие на основе даты истечения в имени инструмента
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

        res.json(data);
    } catch (error) {
        console.error(`Error fetching open interest by strike for ${asset}:`, error);
        res.status(500).json({ message: 'Failed to fetch open interest data', error });
    }
});

module.exports = router;
