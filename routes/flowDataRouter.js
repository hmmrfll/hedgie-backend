const express = require('express');
const pool = require('../config/database');
const router = express.Router();

router.get('/trades', async (req, res) => {
    const { asset, tradeType, optionType, expiration, sizeOrder, premiumOrder } = req.query;

    let tableName;
    if (asset === 'BTC') {
        tableName = 'all_btc_trades';
    } else if (asset === 'ETH') {
        tableName = 'all_eth_trades';
    } else {
        tableName = 'both';
    }

    let query = `
        SELECT *
        FROM ${tableName !== 'both' ? tableName : 'all_btc_trades UNION SELECT * FROM all_eth_trades'}
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
    `;

    if (tradeType && tradeType !== 'Buy/Sell') {
        query += ` AND direction = '${tradeType.toLowerCase()}'`;
    }

    if (optionType && optionType !== 'Call/Put') {
        const optionFilter = optionType === 'Call' ? '-C' : '-P';
        query += ` AND instrument_name LIKE '%${optionFilter}'`;
    }

    if (expiration && expiration !== 'All Expirations') {
        query += ` AND instrument_name LIKE '%${expiration}%'`;
    }

    try {
        const result = await pool.query(query);
        const trades = result.rows;

        if (trades.length === 0) {
            return res.json({ trades: [], putCallRatio: 0, totalPuts: 0, totalCalls: 0, putsPercentage: 0, callsPercentage: 0 });  // Нет данных
        }

        // Рассчитываем среднее значение для размера и премии, игнорируя некорректные значения
        const validTradesForSize = trades.filter(trade => trade.amount && !isNaN(trade.amount));
        const validTradesForPremium = trades.filter(trade => trade.price && !isNaN(trade.price));

        const totalSize = validTradesForSize.reduce((acc, trade) => acc + Number(trade.amount), 0);
        const totalPremium = validTradesForPremium.reduce((acc, trade) => acc + Number(trade.price), 0);

        const averageSize = validTradesForSize.length > 0 ? totalSize / validTradesForSize.length : 0;
        const averagePremium = validTradesForPremium.length > 0 ? totalPremium / validTradesForPremium.length : 0;

        let filteredTrades = trades;

        if (sizeOrder === 'low') {
            filteredTrades = filteredTrades.filter(trade => trade.amount < averageSize);
        } else if (sizeOrder === 'high') {
            filteredTrades = filteredTrades.filter(trade => trade.amount >= averageSize);
        }

        if (premiumOrder === 'low') {
            filteredTrades = filteredTrades.filter(trade => trade.price < averagePremium);
        } else if (premiumOrder === 'high') {
            filteredTrades = filteredTrades.filter(trade => trade.price >= averagePremium);
        }

        if (sizeOrder === 'higher to lower') {
            filteredTrades = filteredTrades.sort((a, b) => b.amount - a.amount);
        } else if (sizeOrder === 'lesser to greater') {
            filteredTrades = filteredTrades.sort((a, b) => a.amount - b.amount);
        }

        if (premiumOrder === 'higher to lower') {
            filteredTrades = filteredTrades.sort((a, b) => b.price - a.price);
        } else if (premiumOrder === 'lesser to greater') {
            filteredTrades = filteredTrades.sort((a, b) => a.price - b.price);
        }

        // Вычисляем Put/Call Ratio и проценты
        const totalCalls = trades.filter(trade => trade.instrument_name.includes('-C')).reduce((acc, trade) => acc + Number(trade.amount), 0);
        const totalPuts = trades.filter(trade => trade.instrument_name.includes('-P')).reduce((acc, trade) => acc + Number(trade.amount), 0);

        const putCallRatio = totalCalls !== 0 ? totalPuts / totalCalls : 0;
        const total = totalCalls + totalPuts;
        const putsPercentage = total !== 0 ? (totalPuts / total) * 100 : 0;
        const callsPercentage = total !== 0 ? (totalCalls / total) * 100 : 0;

        res.json({
            trades: filteredTrades,
            putCallRatio,
            totalPuts,
            totalCalls,
            putsPercentage,
            callsPercentage
        });
    } catch (error) {
        console.error('Error fetching trades with filters:', error);
        res.status(500).json({ message: 'Failed to fetch trades', error });
    }
});

module.exports = router;
