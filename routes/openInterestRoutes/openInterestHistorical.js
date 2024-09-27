const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/historical-open-interest/:asset/:period', async (req, res) => {
    const { asset, period } = req.params;

    // Определяем временной интервал для фильтрации и группировки
    let interval;
    let groupBy;
    switch (period) {
        case '1d':
            interval = '1 day';
            groupBy = 'minute'; // Для 1 дня группируем по минутам
            break;
        case '7d':
            interval = '7 days';
            groupBy = 'hour'; // Для 7 дней группируем по часам
            break;
        case '1m':
            interval = '1 month';
            groupBy = 'day'; // Для 1 месяца группируем по дням
            break;
        default:
            interval = ''; // Для 'All' — нет фильтрации
            groupBy = 'week'; // Для всех данных — группируем по неделям
            break;
    }

    try {
        // Фильтруем по временному интервалу, если он задан
        const timeCondition = interval ? `WHERE timestamp >= NOW() - INTERVAL '${interval}'` : '';

        // Группируем данные по выбранному интервалу
        const query = `
            SELECT 
                date_trunc('${groupBy}', timestamp) AS timestamp, -- Округляем до выбранного интервала
                SUM(contracts) as total_contracts,
                AVG(index_price) as avg_index_price
            FROM ${asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades'}
            ${timeCondition}
            GROUP BY date_trunc('${groupBy}', timestamp) -- Группируем по выбранному интервалу
            ORDER BY timestamp;
        `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch historical open interest data', error });
    }
});

module.exports = router;
