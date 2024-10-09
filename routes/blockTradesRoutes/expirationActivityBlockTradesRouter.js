const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

// Функция для преобразования строки даты истечения в формат YYYY-MM-DD
const convertToISODate = (dateStr) => {
    const year = `20${dateStr.slice(-2)}`;
    const monthStr = dateStr.slice(-5, -2).toUpperCase();
    let day = dateStr.slice(0, dateStr.length - 5);

    const monthMap = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };

    const month = monthMap[monthStr];
    if (!month) {
        return null;
    }

    if (day.length === 1) {
        day = `0${day}`;
    }

    return `${year}-${month}-${day}`;
};

// Получение количества сделок по каждой дате истечения для конкретной валюты и страйка
router.get('/expiration-activity/:currency/:strike?', async (req, res) => {
    const { currency, strike } = req.params;
    const { timeRange } = req.query; // Получаем параметр временного интервала из запроса

    let interval = '24 hours'; // По умолчанию - последние 24 часа

    // Определяем интервал времени на основе выбора пользователя
    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    const tableName = currency.toLowerCase() === 'btc' ? 'btc_block_trades' : 'eth_block_trades';

    try {
        let query = `
            SELECT 
                instrument_name,
                direction,
                COUNT(*) AS trade_count
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
        `;

        // Если указан страйк и он не "all", добавляем условие фильтрации по страйку
        if (strike && strike !== 'all') {
            query += ` AND instrument_name LIKE '%-${strike}-%'`;
        }

        query += `
            GROUP BY 
                instrument_name, direction
            ORDER BY 
                instrument_name;
        `;

        const result = await pool.query(query);

        // Преобразуем данные для извлечения даты истечения и делим на Calls и Puts
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

        // Получаем текущую дату для фильтрации по истекшим датам
        const currentDate = new Date();

        // Фильтруем по актуальным датам и делим по типам
        const filteredData = data.filter(item => {
            const isoDate = convertToISODate(item.expiration_date);
            return isoDate && new Date(isoDate) >= currentDate;
        });

        const calls = filteredData.filter(item => item.type === 'call');
        const puts = filteredData.filter(item => item.type === 'put');

        // Сортируем по дате истечения
        const sortedCalls = calls.sort((a, b) => new Date(convertToISODate(a.expiration_date)) - new Date(convertToISODate(b.expiration_date)));
        const sortedPuts = puts.sort((a, b) => new Date(convertToISODate(a.expiration_date)) - new Date(convertToISODate(b.expiration_date)));

        res.json({ calls: sortedCalls, puts: sortedPuts });
    } catch (error) {
        console.error(`Error fetching expiration activity for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch expiration activity', error });
    }
});

module.exports = router;
