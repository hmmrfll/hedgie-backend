const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

const getTableName = (exchange, asset) => {
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

    return exchangeTables[exchange]?.[asset.toLowerCase()] || null;
};

router.get('/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;
    const { exchange } = req.query;

    const tableName = getTableName(exchange, asset);
    if (!tableName) {
        console.error('Invalid exchange or asset specified');
        return res.status(400).json({ message: 'Invalid exchange or asset specified' });
    }

    try {
        let query = `
            SELECT instrument_name,
            ${tableName.startsWith('okx') ? 'SUM(amount) AS total_contracts' : 'SUM(contracts) AS total_contracts'}
            FROM ${tableName}
        `;

        if (expiration !== 'all') {
            query += ` WHERE instrument_name LIKE '%-${expiration}-%'`;
        }

        query += ` GROUP BY instrument_name`;

        console.log('Executing query:', query);

        const result = await pool.query(query);

        if (result.rows.length === 0) {
            console.warn('No data found for the given parameters');
            return res.status(404).json({ message: 'No data found' });
        }

        const data = { Calls: 0, Puts: 0 };
        result.rows.forEach(row => {
            if (row.instrument_name.endsWith('C')) {
                data.Calls += parseFloat(row.total_contracts) || 0;
            } else if (row.instrument_name.endsWith('P')) {
                data.Puts += parseFloat(row.total_contracts) || 0;
            }
        });

        console.log('Fetched data:', data);
        res.json(data);
    } catch (error) {
        console.error('Failed to fetch open interest data:', error.message);
        res.status(500).json({ message: 'Failed to fetch open interest data', error: error.message });
    }
});

module.exports = router;
