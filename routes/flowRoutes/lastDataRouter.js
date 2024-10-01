const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

// Роутер для получения последних 25 сделок
router.get('/recent-trades', async (req, res) => {
    const { asset, tradeType, optionType, expiration } = req.query;

    let tableName;
    if (asset === 'BTC') {
        tableName = 'all_btc_trades';
    } else if (asset === 'ETH') {
        tableName = 'all_eth_trades';
    } else {
        tableName = 'both';
    }

    let query = `
        SELECT *
        FROM ${tableName !== 'both' ? tableName : 'all_btc_trades UNION SELECT * FROM all_eth_trades'}
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
    `;

    // Фильтр по типу сделки
    if (tradeType && tradeType !== 'Buy/Sell') {
        query += ` AND direction = '${tradeType.toLowerCase()}'`;
    }

    // Фильтр по типу опциона
    if (optionType && optionType !== 'Call/Put') {
        const optionFilter = optionType === 'Call' ? '-C' : '-P';
        query += ` AND instrument_name LIKE '%${optionFilter}'`;
    }

    // Фильтр по дате экспирации
    if (expiration && expiration !== 'All Expirations') {
        query += ` AND instrument_name LIKE '%${expiration}%'`;
    }

    // Ограничиваем количество записей
    query += ` ORDER BY timestamp DESC LIMIT 25`;

    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching recent trades:', error);
        res.status(500).json({ message: 'Failed to fetch recent trades', error });
    }
});

module.exports = router;
