const express = require('express');
const pool = require('../config/database');
const router = express.Router();

// Универсальный запрос для получения данных с фильтрами
router.get('/trades', async (req, res) => {
    const { asset, tradeType, optionType, expiration } = req.query;

    // Определение таблицы на основе актива (BTC или ETH)
    let tableName;
    if (asset === 'BTC') {
        tableName = 'all_btc_trades';
    } else if (asset === 'ETH') {
        tableName = 'all_eth_trades';
    } else {
        // Если выбраны оба актива, выполняем запросы к обеим таблицам
        tableName = 'both';
    }

    // Основной SQL-запрос
    let query = `
        SELECT *
        FROM ${tableName !== 'both' ? tableName : 'all_btc_trades UNION SELECT * FROM all_eth_trades'}
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
    `;

    // Фильтрация по типу сделки (Buy или Sell)
    if (tradeType && tradeType !== 'Buy/Sell') {
        query += ` AND direction = '${tradeType.toLowerCase()}'`;
    }

    // Фильтрация по типу опциона (Call или Put)
    if (optionType && optionType !== 'Call/Put') {
        const optionFilter = optionType === 'Call' ? '-C' : '-P';
        query += ` AND instrument_name LIKE '%${optionFilter}'`;
    }

    // Фильтрация по дате экспирации
    if (expiration && expiration !== 'All Expirations') {
        query += ` AND instrument_name LIKE '%${expiration}%'`;
    }

    try {
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching trades with filters:', error);
        res.status(500).json({ message: 'Failed to fetch trades', error });
    }
});

module.exports = router;
