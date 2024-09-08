const express = require('express');
const pool = require('../config/database');
const router = express.Router();

// Получение количества сделок по часам для каждого актива
router.get('/time-distribution/:currency', async (req, res) => {
    const { currency } = req.params;

    // Определение таблицы в зависимости от валюты
    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        const result = await pool.query(`
            SELECT 
                EXTRACT(HOUR FROM timestamp) AS hour,
                instrument_name,
                direction,
                COUNT(*) AS trade_count,
                AVG(index_price) AS avg_index_price
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY 
                hour, instrument_name, direction
            ORDER BY 
                hour;
        `);

        // Преобразуем данные для фронтенда
        const data = result.rows.map(row => ({
            hour: row.hour,
            trade_count: row.trade_count,
            avg_index_price: row.avg_index_price,
            type: row.instrument_name.includes('-C') ? 'call' : 'put',
            direction: row.direction,
        }));

        // Разделяем данные на Call и Put
        const calls = data.filter(item => item.type === 'call');
        const puts = data.filter(item => item.type === 'put');

        res.json({ calls, puts });
    } catch (error) {
        console.error(`Error fetching time distribution for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch time distribution', error });
    }
});

module.exports = router;
