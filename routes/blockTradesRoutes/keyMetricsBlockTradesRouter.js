const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

// Получение основных метрик для BTC/ETH за последние 24 часа
router.get('/key-metrics/:currency', async (req, res) => {
    const { currency } = req.params;

    const tableName = currency.toLowerCase() === 'btc' ? 'btc_block_trades' : 'eth_block_trades';

    try {
        // Добавляем запрос для получения всех данных по сделкам за последние 24 часа
        const tradesResult = await pool.query(`
            SELECT 
                amount, 
                index_price
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours'
        `);

        // Логируем каждую сделку для расчета Total Volume
        let totalVolume = 0;
        tradesResult.rows.forEach(trade => {
            const amount = trade.amount || 0;
            const indexPrice = trade.index_price || 0;
            const volume = amount * indexPrice;
            totalVolume += volume;

        });

        // Выполняем запрос для остальных метрик
        const result = await pool.query(`
            SELECT 
                SUM(COALESCE(price * index_price, 0)) / COUNT(price) AS avg_price, -- Средняя цена сделки, пересчитанная в USD
                SUM(COALESCE(amount * index_price, 0)) AS total_nominal_volume, -- Номинальный объём (в долларах): объём * индексная цена
                SUM(COALESCE(price * amount * index_price, 0)) AS total_premium, -- Премия: цена сделки * объём * индексная цена
                COUNT(CASE WHEN liquidation IS NOT NULL THEN 1 END) AS liquidation_count -- Количество ликвидаций
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours'
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
