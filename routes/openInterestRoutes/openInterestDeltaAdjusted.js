const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

// Функция для определения таблицы на основе биржи и актива
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

router.get('/delta-adjusted-open-interest-by-strike/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;
    const { exchange } = req.query;

    const tableName = getTableName(exchange, asset);
    if (!tableName) {
        console.error('Invalid exchange or asset specified');
        return res.status(400).json({ message: 'Invalid exchange or asset specified' });
    }

    try {
        const expirationCondition = expiration === 'all' ? '' : `AND instrument_name LIKE '%${expiration.replace(/\s+/g, '')}%'`;

        // Определяем поле количества контрактов в зависимости от биржи
        const contractField = exchange === 'OKX' ? 'amount' : 'contracts';

        const query = `
            SELECT 
                CAST(SUBSTRING(instrument_name FROM '-([0-9]+)-[PC]$') AS INTEGER) AS strike,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN ${contractField} * iv ELSE 0 END) AS puts_delta_adjusted,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN ${contractField} * iv ELSE 0 END) AS calls_delta_adjusted
            FROM ${tableName}
            WHERE instrument_name IS NOT NULL
            ${expirationCondition}
            GROUP BY strike
            ORDER BY strike;
        `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Failed to fetch delta adjusted open interest data:', error);
        res.status(500).json({ message: 'Failed to fetch delta adjusted open interest data', error });
    }
});

module.exports = router;
