const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

const getTableName = (exchange, currency) => {
    const exchangeTables = {
        OKX: {
            btc: 'okx_btc_trades',
            eth: 'okx_eth_trades',
        },
        DER: {
            btc: 'all_btc_trades',
            eth: 'all_eth_trades',
        },
    };

    const lowerCaseCurrency = currency.toLowerCase();
    return exchangeTables[exchange]?.[lowerCaseCurrency] || null;
};

router.get('/option-volumes/:currency', async (req, res) => {
    const { currency } = req.params;
    const { timeRange, exchange } = req.query;
    let interval = '24 hours';

    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    const tableName = getTableName(exchange, currency);

    if (!tableName) {
        return res.status(400).json({ message: 'Invalid exchange or currency specified' });
    }

    try {
        const result = await pool.query(`
            SELECT 
                instrument_name, 
                SUM(amount * index_price) AS total_volume
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
            GROUP BY 
                instrument_name
            ORDER BY 
                total_volume DESC
            LIMIT 10;
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(`Error fetching option volumes for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch option volumes', error });
    }
});

module.exports = router;
