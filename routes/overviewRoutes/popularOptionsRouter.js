const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

// Route to get popular options for a specific currency (BTC/ETH)
router.get('/popular-options/:currency', async (req, res) => {
    const { currency } = req.params;
    const { timeRange } = req.query; // Получаем параметр временного интервала из запроса
    let interval = '24 hours'; // По умолчанию берем последние 24 часа

    // Определяем временной интервал на основе параметра
    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    // Определяем нужную таблицу на основе валюты (BTC или ETH)
    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        // Запрос для получения популярных опционов на основе их названия и количества сделок
        const result = await pool.query(`
            SELECT 
                instrument_name, 
                COUNT(*) AS trade_count
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
            GROUP BY 
                instrument_name
            ORDER BY 
                trade_count DESC
            LIMIT 10;
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(`Error fetching popular options for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch popular options', error });
    }
});

module.exports = router;
