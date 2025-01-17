const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/strike-activity/:currency', async (req, res) => {
    const { currency } = req.params;
    const { expiration, timeRange } = req.query;

    let interval = '24 hours';

    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    const tableName = currency.toLowerCase() === 'btc' ? 'btc_block_trades' : 'eth_block_trades';

    try {
        let query = `
            SELECT 
                instrument_name, 
                COUNT(*) AS trade_count
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
        `;

        if (expiration && expiration !== 'All Expirations') {
            query += ` AND instrument_name LIKE '%${expiration.replace(/\s+/g, '').toUpperCase()}%'`;
        }

        query += `
            GROUP BY 
                instrument_name
            ORDER BY 
                trade_count DESC
            LIMIT 10;
        `;

        const result = await pool.query(query);

        const dataWithStrike = result.rows.map(row => {
            const match = row.instrument_name.match(/(\d+)-([CP])$/);
            const strike_price = match ? match[1] : null;
            const option_type = match ? match[2] : null;
            return {
                ...row,
                strike_price: strike_price ? parseInt(strike_price, 10) : undefined,
                option_type: option_type || undefined,
            };
        });

        res.json(dataWithStrike);
    } catch (error) {
        console.error(`Error fetching strike activity for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch strike activity', error });
    }
});

module.exports = router;
