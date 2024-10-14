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

    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        // Извлекаем только дату истечения из названия инструмента и тип опциона
        let query = `
            SELECT 
                SUBSTRING(instrument_name FROM '([0-9]{1,2}[A-Z]{3}[0-9]{2})') AS expiration_date,
                CASE WHEN instrument_name LIKE '%-C' THEN 'call' ELSE 'put' END AS option_type,
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
                expiration_date, option_type
            ORDER BY 
                expiration_date;
        `;

        const result = await pool.query(query);

        // Преобразуем данные для извлечения даты истечения и делим на Calls и Puts
        const data = result.rows.map(row => ({
            expiration_date: row.expiration_date,
            option_type: row.option_type,
            trade_count: parseInt(row.trade_count)
        }));

        // Группировка данных по дате истечения и типу опциона (Call/Put)
        const groupedData = data.reduce((acc, item) => {
            const key = `${item.expiration_date}_${item.option_type}`;
            if (!acc[key]) {
                acc[key] = {
                    expiration_date: item.expiration_date,
                    option_type: item.option_type,
                    trade_count: 0
                };
            }
            acc[key].trade_count += item.trade_count;
            return acc;
        }, {});

        // Преобразование обратно в массив
        const groupedArray = Object.values(groupedData);

        // Сортировка по дате истечения
        const sortedData = groupedArray.sort((a, b) => new Date(convertToISODate(a.expiration_date)) - new Date(convertToISODate(b.expiration_date)));

        res.json(sortedData);
    } catch (error) {
        console.error(`Error fetching expiration activity for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch expiration activity', error });
    }
});

module.exports = router;
