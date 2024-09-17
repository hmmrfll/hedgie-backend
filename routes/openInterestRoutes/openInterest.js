// routes/openInterest.js
const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;

    const tableName = asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        // SQL-запрос для получения контрактов за последние 24 часа
        let query = `
            SELECT instrument_name, SUM(contracts) as total_contracts
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
        `;

        // Добавляем фильтр по expiration, если оно не "all"
        if (expiration !== 'all') {
            console.log(`Applying expiration filter: ${expiration}`);
            query += ` AND instrument_name LIKE '%-${expiration}-%'`;
        } else {
            console.log('No expiration filter applied');
        }

        query += ` GROUP BY instrument_name`;

        const result = await pool.query(query);

        // Разделение контрактов на Calls и Puts
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
        res.status(500).json({ message: 'Failed to fetch open interest data', error });
    }
});

module.exports = router;
