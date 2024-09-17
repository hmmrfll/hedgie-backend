const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/open-interest-by-strike/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;
    try {
        // Условие для фильтрации по дате экспирации
        const expirationCondition = expiration === 'all' ? '' : `AND instrument_name LIKE '%${expiration}%'`;

        const query = `
            SELECT 
                CAST(SUBSTRING(instrument_name FROM '-([0-9]+)-[PC]$') AS INTEGER) AS strike,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts ELSE 0 END) AS puts,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts ELSE 0 END) AS calls,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts * mark_price ELSE 0 END) AS calls_market_value
            FROM ${asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades'}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ${expirationCondition} -- Условие на основе даты истечения в имени инструмента
            GROUP BY strike
            ORDER BY strike;
        `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch open interest data', error });
    }
});

module.exports = router;
