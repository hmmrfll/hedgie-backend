const express = require('express');
const pool = require('../../config/database'); // Подключение к базе данных
const router = express.Router();

// Маршрут для получения данных об открытых интересах с поправкой на дельту
router.get('/delta-adjusted-open-interest-by-strike/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;
    try {
        // Условие для фильтрации по дате экспирации
        const expirationCondition = expiration === 'all' ? '' : `AND instrument_name LIKE '%${expiration}%'`;

        const query = `
            SELECT 
                CAST(SUBSTRING(instrument_name FROM '-([0-9]+)-[PC]$') AS INTEGER) AS strike,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts * iv ELSE 0 END) AS puts_delta_adjusted,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts * iv ELSE 0 END) AS calls_delta_adjusted
            FROM ${asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades'}
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
