const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

// Функция для определения таблицы на основе биржи и актива
const getTableName = (exchange, asset) => {
    const exchangeTables = {
        OKX: {
            btc: 'okx_btc_trades',
            eth: 'okx_eth_trades',
        },
        DER: {
            btc: 'all_btc_trades',
            eth: 'all_eth_trades',
        },
    };

    const lowerCaseAsset = asset.toLowerCase();
    return exchangeTables[exchange]?.[lowerCaseAsset] || null;
};

router.get('/historical-open-interest/:asset/:period', async (req, res) => {
    const { asset, period } = req.params;
    const { exchange } = req.query;

    let interval;
    let groupBy;
    switch (period) {
        case '1d':
            interval = '1 day';
            groupBy = "hour";
            break;
        case '7d':
            interval = '7 days';
            groupBy = 'hour';
            break;
        case '1m':
            interval = '1 month';
            groupBy = 'day';
            break;
        default:
            interval = '';
            groupBy = 'week';
            break;
    }

    const tableName = getTableName(exchange, asset);
    if (!tableName) {
        console.error('Invalid exchange or asset specified');
        return res.status(400).json({ message: 'Invalid exchange or asset specified' });
    }

    try {
        const timeCondition = interval ? `WHERE timestamp >= NOW() - INTERVAL '${interval}'` : '';

        // Определяем поле для количества контрактов в зависимости от биржи
        const contractField = exchange === 'OKX' ? 'amount' : 'contracts';

        const query = `
            SELECT 
                date_trunc('${groupBy}', timestamp) AS timestamp, -- Округляем до выбранного интервала
                SUM(${contractField}) as total_contracts,
                AVG(index_price) as avg_index_price
            FROM ${tableName}
            ${timeCondition}
            GROUP BY date_trunc('${groupBy}', timestamp) -- Группируем по выбранному интервалу
            ORDER BY timestamp;
        `;

        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching historical open interest data:', error);
        res.status(500).json({ message: 'Failed to fetch historical open interest data', error });
    }
});

module.exports = router;
