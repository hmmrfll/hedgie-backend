const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

const getTableName = (exchange, currency) => {
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

    const lowerCaseCurrency = currency.toLowerCase();
    return exchangeTables[exchange]?.[lowerCaseCurrency] || null;
};
router.get('/time-distribution/:currency', async (req, res) => {
    const { currency } = req.params;
    const { timeRange, exchange } = req.query;

    let interval = '24 hours';

    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    const tableName = getTableName(exchange, currency);

    if (!tableName) {
        return res.status(400).json({ message: 'Invalid exchange or currency specified' });
    }

    try {
        const result = await pool.query(`
            SELECT
                timestamp,
                instrument_name,
                direction,
                COUNT(*) AS trade_count,
                AVG(index_price) AS avg_index_price
            FROM
                ${tableName}
            WHERE
                timestamp >= NOW() - INTERVAL '${interval}'
            GROUP BY
                timestamp, instrument_name, direction
            ORDER BY
                timestamp;
        `);

        const currentHour = new Date().getUTCHours();

        const timeDistribution = Array.from({ length: 24 }, (_, i) => ({
            hour: (currentHour - i + 24) % 24,
            calls: [],
            puts: []
        }));

        result.rows.forEach(row => {
            const tradeHour = new Date(row.timestamp).getUTCHours();
            const tradeData = {
                trade_count: row.trade_count,
                avg_index_price: row.avg_index_price,
                type: row.instrument_name.includes('-C') ? 'call' : 'put',
                direction: row.direction,
            };

            const index = (currentHour - tradeHour + 24) % 24;

            if (tradeData.type === 'call') {
                timeDistribution[index].calls.push(tradeData);
            } else {
                timeDistribution[index].puts.push(tradeData);
            }
        });

        res.json(timeDistribution);
    } catch (error) {
        console.error(`Error fetching time distribution for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch time distribution', error });
    }
});

module.exports = router;

