const express = require('express');
const pool = require('../config/database'); // Assuming you have the database config set up
const router = express.Router();

// Route to get popular options for a specific currency (BTC/ETH)
router.get('/popular-options/:currency', async (req, res) => {
    const { currency } = req.params;

    // Determine the correct table based on currency
    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        // Fetch the popular options based on instrument_name and count the number of trades
        const result = await pool.query(`
            SELECT 
                instrument_name, 
                COUNT(*) AS trade_count
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours'
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
