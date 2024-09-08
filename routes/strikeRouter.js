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

        // Извлекаем страйки из instrument_name
        const strikes = result.rows
            .map(row => {
                const match = row.instrument_name.match(/(\d+)-[CP]$/); // Ищем цифры перед -C или -P
                return match ? match[1] : null;
            })
            .filter(Boolean); // Убираем null значения

        // Оставляем только уникальные страйки
        const uniqueStrikes = [...new Set(strikes)];

        res.json(uniqueStrikes);
    } catch (error) {
        console.error(`Error fetching strikes for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch strikes', error });
    }
});

module.exports = router;
