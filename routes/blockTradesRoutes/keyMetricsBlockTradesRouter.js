const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/key-metrics/:currency', async (req, res) => {
    const { currency } = req.params;
    const { timeRange } = req.query;

    let interval = '24 hours';

    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    const tableName = currency.toLowerCase() === 'btc' ? 'btc_block_trades' : 'eth_block_trades';

    try {
        const tradesResult = await pool.query(`
            SELECT 
                amount, 
                index_price
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
        `);

        let totalVolume = 0;
        tradesResult.rows.forEach(trade => {
            const amount = trade.amount || 0;
            const indexPrice = trade.index_price || 0;
            const volume = amount * indexPrice;
            totalVolume += volume;
        });

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
            avg_price: data.avg_price || 0,
            total_nominal_volume: totalVolume || 0,
            total_premium: data.total_premium || 0,
            liquidation_count: data.liquidation_count || 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch key metrics', error });
    }
});

module.exports = router;
