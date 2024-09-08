const express = require('express');
const pool = require('../config/database');
const router = express.Router();

// Функция для преобразования строкового формата DDMMMYY в формат YYYY-MM-DD
const convertToISODate = (dateStr) => {
    const day = dateStr.slice(0, 2);
    const monthStr = dateStr.slice(2, 5);
    const year = `20${dateStr.slice(5)}`; // Добавляем "20" для преобразования года (24 -> 2024)

    const monthMap = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };

    const month = monthMap[monthStr.toUpperCase()];
    return `${year}-${month}-${day}`; // Приводим к формату YYYY-MM-DD
};

router.get('/expirations/:currency', async (req, res) => {
    const { currency } = req.params;
    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        const result = await pool.query(`
            SELECT DISTINCT instrument_name
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
        `);

        // Извлекаем даты экспирации из instrument_name
        const expirations = result.rows
            .map(row => {
                const match = row.instrument_name.match(/(\d{1,2}[A-Z]{3}\d{2})/); // Ищем даты в формате DDMMMYY
                return match ? match[1] : null;
            })
            .filter(Boolean); // Убираем null значения

        // Преобразуем даты в ISO-формат и сортируем их
        const sortedExpirations = [...new Set(expirations)]
            .map(date => ({
                original: date,
                isoDate: convertToISODate(date),
            }))
            .sort((a, b) => new Date(a.isoDate) - new Date(b.isoDate))
            .map(item => item.original); // Возвращаем оригинальные даты после сортировки

        res.json(sortedExpirations);
    } catch (error) {
        console.error(`Error fetching expirations for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch expirations', error });
    }
});

module.exports = router;
