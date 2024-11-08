const express = require('express');
const router = express.Router();
const pool = require('../../config/database');

router.get('/data-download/:dataType/:timeRange', async (req, res) => {
    const { dataType, timeRange } = req.params;
    const { checkOnly } = req.query;

    try {
        const data = await getData(dataType, timeRange);
        if (!data || data.length === 0) {
            if (checkOnly === 'true') {
                return res.status(204).send();
            } else {
                return res.status(200).json({ message: 'No data available for the selected filters.' });
            }
        }

        if (checkOnly === 'true') {
            return res.status(200).json({ message: 'Data is available.' });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error('Ошибка при скачивании данных:', error.message);
        res.status(500).json({ message: 'Error downloading data', error: error.message });
    }
});

const getData = async (dataType, timeRange) => {
    try {
        let tableName;
        switch (dataType) {
            case 'All BTC Trades':
                tableName = 'all_btc_trades';
                break;
            case 'All ETH Trades':
                tableName = 'all_eth_trades';
                break;
            case 'BTC Block Trades':
                tableName = 'btc_block_trades';
                break;
            case 'ETH Block Trades':
                tableName = 'eth_block_trades';
                break;
            default:
                throw new Error('Invalid data type');
        }

        let days;
        switch (timeRange) {
            case '1d':
                days = 1;
                break;
            case '2d':
                days = 2;
                break;
            case '3d':
                days = 3;
                break;
            case '4d':
                days = 4;
                break;
            case '5d':
                days = 5;
                break;
            case '6d':
                days = 6;
                break;
            case '7d':
                days = 7;
                break;
            case '10d':
                days = 10;
                break;
            case '1m':
                days = 30;
                break;
            case '1y':
                days = 365;
                break;
            default:
                throw new Error('Invalid time range');
        }

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const query = `SELECT * FROM ${tableName} WHERE timestamp >= $1 AND timestamp <= $2`;
        const result = await pool.query(query, [startDate, endDate]);

        if (!result) {
            console.log('Запрос не вернул результат');
            throw new Error('Query returned no result');
        }

        return result.rows;
    } catch (error) {
        console.error('Ошибка при получении данных из базы данных:', error.message);
        throw error;
    }
};

module.exports = router;
