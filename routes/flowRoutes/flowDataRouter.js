const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/trades', async (req, res) => {
    const { asset, limit = 25 } = req.query;

    let tableName = asset === 'BTC' ? 'all_btc_trades' : 'all_eth_trades';

    let query = `
        SELECT *
        FROM ${tableName}
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
    `;

    // Лимитируем количество строк для вывода сделок
    query += ` LIMIT ${Number(limit)}`;

    try {
        const result = await pool.query(query);
        const trades = result.rows;

        if (trades.length === 0) {
            return res.json({
                trades: [],
                putCallRatio: 0,
                totalPuts: 0,
                totalCalls: 0,
                putsPercentage: 0,
                callsPercentage: 0
            });
        }

        // Рассчитываем Total Calls, Total Puts и Put to Call Ratio на основе данных за последние 24 часа
        const totalCalls = trades.filter(trade => trade.instrument_name.includes('-C')).reduce((acc, trade) => acc + Number(trade.amount), 0);
        const totalPuts = trades.filter(trade => trade.instrument_name.includes('-P')).reduce((acc, trade) => acc + Number(trade.amount), 0);

        const putCallRatio = totalCalls !== 0 ? totalPuts / totalCalls : 0;
        const total = totalCalls + totalPuts;
        const putsPercentage = total !== 0 ? (totalPuts / total) * 100 : 0;
        const callsPercentage = total !== 0 ? (totalCalls / total) * 100 : 0;

        res.json({
            trades,
            putCallRatio,
            totalPuts,
            totalCalls,
            putsPercentage,
            callsPercentage
        });
    } catch (error) {
        console.error('Error fetching trades:', error);
        res.status(500).json({ message: 'Failed to fetch trades', error });
    }
});

module.exports = router;