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

router.get('/open-interest/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;
    const { exchange } = req.query;

    const tableName = getTableName(exchange, asset);
    if (!tableName) {
        console.error('Invalid exchange or asset specified');
        return res.status(400).json({ message: 'Invalid exchange or asset specified' });
    }

    try {
        // Определяем поле для контрактов в зависимости от биржи
        const contractField = exchange === 'OKX' ? 'amount' : 'contracts';

        let query = `
            SELECT instrument_name, SUM(${contractField}) as total_contracts
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
        `;

        if (expiration !== 'all') {
            query += ` AND instrument_name LIKE '%-${expiration}-%'`;
        }

        query += ` GROUP BY instrument_name`;

        const result = await pool.query(query);

        const data = {
            Calls: 0,
            Puts: 0,
        };

        result.rows.forEach(row => {
            if (row.instrument_name.endsWith('C')) {
                data.Calls += parseFloat(row.total_contracts);
            } else if (row.instrument_name.endsWith('P')) {
                data.Puts += parseFloat(row.total_contracts);
            }
        });

        res.json(data);
    } catch (error) {
        console.error('Failed to fetch open interest data:', error.message);
        res.status(500).json({ message: 'Failed to fetch open interest data', error: error.message });
    }
});

module.exports = router;
