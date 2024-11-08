const express = require('express');
const pool = require('../../config/database');
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
        return null;
    }

    if (day.length === 1) {
        day = `0${day}`;
    }

    return `${year}-${month}-${day}`;
};

router.get('/expiration-activity/:currency/:strike?', async (req, res) => {
    const { currency, strike } = req.params;
    const { timeRange } = req.query;

    let interval = '24 hours';

    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    const tableName = currency.toLowerCase() === 'btc' ? 'btc_block_trades' : 'eth_block_trades';

    try {
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

        const data = result.rows.map(row => ({
            expiration_date: row.expiration_date,
            option_type: row.option_type,
            trade_count: parseInt(row.trade_count)
        }));

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

        const groupedArray = Object.values(groupedData);

        const sortedData = groupedArray.sort((a, b) => new Date(convertToISODate(a.expiration_date)) - new Date(convertToISODate(b.expiration_date)));

        res.json(sortedData);
    } catch (error) {
        console.error(`Error fetching expiration activity for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch expiration activity', error });
    }
});

module.exports = router;
