const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/historical-open-interest/:asset/:period', async (req, res) => {
    const { asset, period } = req.params;

    // Определяем временной интервал для запроса
    let interval;
    switch (period) {
        case '1d':
            interval = '1 day';
            break;
        case '7d':
            interval = '7 days';
            break;
        case '1m':
            interval = '1 month';
            break;
        default:
            interval = ''; // Для 'All'
            break;
    }

    try {
        // Фильтруем по временному интервалу, если он задан
        const timeCondition = interval ? `WHERE timestamp >= NOW() - INTERVAL '${interval}'` : '';

        const query = `
            SELECT 
                timestamp,
                SUM(contracts) as total_contracts,
                AVG(index_price) as avg_index_price
            FROM ${asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades'}
            ${timeCondition}
            GROUP BY timestamp
            ORDER BY timestamp;
        `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch historical open interest data', error });
    }
});

module.exports = router;
