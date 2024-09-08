const express = require('express');
const pool = require('../config/database');
const router = express.Router();

// Получение основных метрик для BTC/ETH за последние 24 часа
router.get('/key-metrics/:currency', async (req, res) => {
    const { currency } = req.params;

    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        const result = await pool.query(`
            SELECT 
                AVG(price) AS avg_price, 
                SUM(amount) AS total_volume,
                SUM(price * amount) AS total_premium,
                COUNT(CASE WHEN liquidation IS NOT NULL THEN 1 END) AS liquidation_count
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours'
        `);

        const data = result.rows[0];

        res.json({
            avg_price: data.avg_price || 0,
            total_volume: data.total_volume || 0,
            total_premium: data.total_premium || 0,
            liquidation_count: data.liquidation_count || 0
        });
    } catch (error) {
        console.error(`Error fetching key metrics for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch key metrics', error });
    }
});

module.exports = router;
