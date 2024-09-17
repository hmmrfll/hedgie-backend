const express = require('express');
const pool = require('../../config/database'); // Подключение к базе данных
const router = express.Router();

// Маршрут для получения данных об открытых интересах по экспирации
router.get('/open-interest-by-expiration/:asset/:strike', async (req, res) => {
    const { asset, strike } = req.params;
    try {
        // Формируем SQL-запрос в зависимости от выбранного страйка
        const strikeCondition = strike === 'all' ? '' : `AND instrument_name LIKE '%-${strike}-%'`;

        const query = `
            SELECT 
                to_char(timestamp, 'DD-MON-YY') AS expiration,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts ELSE 0 END) AS puts_otm,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts ELSE 0 END) AS calls_otm,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts * mark_price ELSE 0 END) AS calls_market_value,
                SUM(contracts * mark_price) AS notional_value
            FROM ${asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades'}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ${strikeCondition}
            GROUP BY expiration
            ORDER BY expiration;
        `;

        const result = await pool.query(query);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch open interest data', error });
    }
});

module.exports = router;
