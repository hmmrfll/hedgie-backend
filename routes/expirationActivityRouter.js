const express = require('express');
const pool = require('../config/database');
const router = express.Router();

// Получение количества сделок по каждой дате истечения для конкретной валюты и страйка
router.get('/expiration-activity/:currency/:strike?', async (req, res) => {
    const { currency, strike } = req.params;
    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        let query = `
            SELECT 
                instrument_name,
                direction,
                COUNT(*) AS trade_count
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours'
        `;

        // Если указан страйк, добавляем условие фильтрации по страйку
        if (strike) {
            query += ` AND instrument_name LIKE '%-${strike}-%'`;
        }

        query += `
            GROUP BY 
                instrument_name, direction
            ORDER BY 
                instrument_name;
        `;

        const result = await pool.query(query);

        // Преобразуем данные для извлечения даты экспирации и делим на Calls и Puts
        const data = result.rows.map(row => {
            const match = row.instrument_name.match(/(\d{1,2}[A-Z]{3}\d{2})/); // Ищем даты в формате DDMMMYY
            const expiration_date = match ? match[1] : null;

            return {
                expiration_date,
                trade_count: row.trade_count,
                type: row.instrument_name.includes('-C') ? 'call' : 'put',
                direction: row.direction
            };
        });

        // Фильтруем по датам и делим по типам
        const calls = data.filter(item => item.type === 'call');
        const puts = data.filter(item => item.type === 'put');

        res.json({ calls, puts });
    } catch (error) {
        console.error(`Error fetching expiration activity for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch expiration activity', error });
    }
});

module.exports = router;
