const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

// Route to get popular options for a specific currency (BTC/ETH)
router.get('/popular-options/:currency', async (req, res) => {
    const { currency } = req.params;
    const { type } = req.query; // Получаем тип сделки (simple или block)

    // Определяем таблицы в зависимости от валюты
    let tradesTable;
    if (currency.toLowerCase() === 'btc') {
        tradesTable = type === 'block' ? 'btc_block_trades' : 'all_btc_trades';
    } else if (currency.toLowerCase() === 'eth') {
        tradesTable = type === 'block' ? 'eth_block_trades' : 'all_eth_trades';
    } else {
        return res.status(400).json({ message: 'Invalid currency' });
    }

    try {
        // Получаем популярные опционы из выбранной таблицы (в зависимости от типа сделки)
        const result = await pool.query(`
            SELECT 
                instrument_name, 
                COUNT(*) AS trade_count
            FROM 
                ${tradesTable}
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY 
                instrument_name
            ORDER BY 
                trade_count DESC
            LIMIT 10;
        `);

        res.json(result.rows);
    } catch (error) {
        console.error(`Error fetching popular options for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch popular options', error });
    }
});

module.exports = router;
