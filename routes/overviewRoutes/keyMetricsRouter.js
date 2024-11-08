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
    return exchangeTables[exchange?.toUpperCase()]?.[lowerCaseCurrency] || null;
};

// Функция для проверки наличия столбца в таблице
const columnExists = async (tableName, columnName) => {
    const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
    `, [tableName, columnName]);
    return result.rows.length > 0;
};

router.get('/key-metrics/:currency', async (req, res) => {
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
        const hasLiquidationColumn = await columnExists(tableName, 'liquidation');

        const tradesResult = await pool.query(`
            SELECT amount, index_price
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '${interval}'
        `);

        let totalVolume = 0;
        tradesResult.rows.forEach(trade => {
            const amount = trade.amount || 0;
            const indexPrice = trade.index_price || 0;
            totalVolume += amount * indexPrice;
        });

        const liquidationCountQuery = hasLiquidationColumn ? 'COUNT(CASE WHEN liquidation IS NOT NULL THEN 1 END) AS liquidation_count' : '0 AS liquidation_count';

        const result = await pool.query(`
            SELECT 
                SUM(COALESCE(price * amount * index_price, 0)) / COUNT(*) AS avg_price,
                SUM(COALESCE(amount * index_price, 0)) AS total_nominal_volume,
                SUM(COALESCE(price * amount * index_price, 0)) AS total_premium,
                ${liquidationCountQuery}
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
        `);

        const data = result.rows[0];
        res.json({
            avg_price: data.avg_price || 0,
            total_nominal_volume: totalVolume || 0,
            total_premium: data.total_premium || 0,
            liquidation_count: data.liquidation_count || 0
        });
    } catch (error) {
        console.error('Failed to fetch key metrics:', error);
        res.status(500).json({ message: 'Failed to fetch key metrics', error });
    }
});

module.exports = router;
