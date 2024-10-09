const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/key-metrics/:currency', async (req, res) => {
    const { currency } = req.params;
    const { timeRange } = req.query; // Получаем временной интервал из запроса

    let interval = '24 hours'; // По умолчанию - последние 24 часа

    // Определяем интервал времени на основе выбора пользователя
    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        // Запрос для получения всех данных по сделкам за выбранный интервал времени
        const tradesResult = await pool.query(`
            SELECT 
                amount, 
                index_price
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
        `);

        // Рассчитываем общий объем (total nominal volume)
        let totalVolume = 0;
        tradesResult.rows.forEach(trade => {
            const amount = trade.amount || 0;
            const indexPrice = trade.index_price || 0;
            const volume = amount * indexPrice;
            totalVolume += volume;
        });

        // Запрос для расчета средней цены, общего объема и других метрик
        const result = await pool.query(`
            SELECT 
                SUM(COALESCE(price * amount * index_price, 0)) / COUNT(*) AS avg_price, -- Средняя цена сделки с учетом объема
                SUM(COALESCE(amount * index_price, 0)) AS total_nominal_volume, -- Номинальный объём (в долларах): объём * индексная цена
                SUM(COALESCE(price * amount * index_price, 0)) AS total_premium, -- Премия: цена сделки * объём * индексная цена
                COUNT(CASE WHEN liquidation IS NOT NULL THEN 1 END) AS liquidation_count -- Количество ликвидаций
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
        `);

        const data = result.rows[0];

        res.json({
            avg_price: data.avg_price || 0, // Средняя цена сделки (в USD)
            total_nominal_volume: totalVolume || 0, // Общий объём (в USD)
            total_premium: data.total_premium || 0, // Общая премия (в USD)
            liquidation_count: data.liquidation_count || 0 // Количество ликвидаций
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch key metrics', error });
    }
});

module.exports = router;
