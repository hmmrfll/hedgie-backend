const express = require('express');
const pool = require('../config/database');
const router = express.Router();

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
        console.error(`Ошибка: не удалось найти месяц для строки: ${dateStr}`);
        return null;
    }

    if (day.length === 1) {
        day = `0${day}`;
    }

    const isoDate = `${year}-${month}-${day}`;
    return isoDate;
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

        const expirations = result.rows
            .map(row => {
                const match = row.instrument_name.match(/(\d{1,2}[A-Z]{3}\d{2})/);
                return match ? match[1] : null;
            })
            .filter(Boolean);

        const sortedExpirations = [...new Set(expirations)]
            .map(date => ({
                original: date,
                isoDate: convertToISODate(date),
            }))
            .sort((a, b) => new Date(a.isoDate) - new Date(b.isoDate));

        const finalExpirations = sortedExpirations.map(item => item.original);

        res.json(finalExpirations);
    } catch (error) {
        console.error(`Error fetching expirations for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch expirations', error });
    }
});

module.exports = router;
