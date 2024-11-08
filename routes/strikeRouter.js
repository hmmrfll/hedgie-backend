const express = require('express');
const pool = require('../config/database');
const router = express.Router();

router.get('/strikes/:currency', async (req, res) => {
    const { currency } = req.params;
    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        const result = await pool.query(`
            SELECT DISTINCT instrument_name
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
        `);

        const strikes = result.rows
            .map(row => {
                const match = row.instrument_name.match(/(\d+)-[CP]$/);
                return match ? parseInt(match[1], 10) : null;
            })
            .filter(Boolean);

        const uniqueSortedStrikes = [...new Set(strikes)].sort((a, b) => a - b);

        res.json(uniqueSortedStrikes);
    } catch (error) {
        console.error(`Error fetching strikes for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch strikes', error });
    }
});

module.exports = router;
