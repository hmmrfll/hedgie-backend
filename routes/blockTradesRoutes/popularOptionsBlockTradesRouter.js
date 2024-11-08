const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/popular-options/:currency', async (req, res) => {
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
