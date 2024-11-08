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
router.get('/strike-activity/:currency', async (req, res) => {
    const { currency } = req.params;
    const { expiration, timeRange, exchange } = req.query;

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
                trade_count DESC;
        `;

        const result = await pool.query(query);

        const aggregatedData = {};

        result.rows.forEach(row => {
            const match = row.instrument_name.match(/(\d+)-([CP])$/);
            const strike_price = match ? parseInt(match[1], 10) : null;
            const option_type = match ? match[2] : null;

            if (strike_price && option_type) {
                const key = `${strike_price}-${option_type}`;

                if (aggregatedData[key]) {
                    aggregatedData[key].trade_count += parseInt(row.trade_count, 10);
                } else {
                    aggregatedData[key] = {
                        strike_price,
                        option_type,
                        trade_count: parseInt(row.trade_count, 10),
                    };
                }
            }
        });

        const dataWithStrike = Object.values(aggregatedData);

        res.json(dataWithStrike);
    } catch (error) {
        console.error(`Error fetching strike activity for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch strike activity', error });
    }
});

module.exports = router;
