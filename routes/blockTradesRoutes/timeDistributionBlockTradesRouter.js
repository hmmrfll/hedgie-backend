const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

// Получение количества сделок по часовым интервалам для каждого актива
router.get('/time-distribution/:currency', async (req, res) => {
    const { currency } = req.params;

    // Определение таблицы в зависимости от валюты
    const tableName = currency.toLowerCase() === 'btc' ? 'btc_block_trades' : 'eth_block_trades';

    try {
        // Запрос данных за последние 24 часа с группировкой по timestamp
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
                timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY 
                timestamp, instrument_name, direction
            ORDER BY 
                timestamp;
        `);

        // Инициализация массива на 24 часа с учетом текущего времени
        const currentHour = new Date().getUTCHours(); // Текущий час в UTC
        const timeDistribution = Array.from({ length: 24 }, (_, i) => ({
            hour: (currentHour - i + 24) % 24, // Рассчитываем сдвиг относительно текущего часа
            calls: [],
            puts: [],
        })).reverse(); // Реверсируем массив, чтобы текущий час был последним

        // Обработка каждой сделки и группировка по часам
        result.rows.forEach(row => {
            const hour = new Date(row.timestamp).getUTCHours(); // Получаем час сделки в UTC
            const tradeData = {
                trade_count: row.trade_count,
                avg_index_price: row.avg_index_price,
                type: row.instrument_name.includes('-C') ? 'call' : 'put',  // Определение Call или Put
                direction: row.direction,
            };

            // Находим соответствующий час в timeDistribution
            const hourIndex = (currentHour - hour + 24) % 24;

            // Группировка по типу сделки (Call/Put)
            if (tradeData.type === 'call') {
                timeDistribution[hourIndex].calls.push(tradeData);
            } else {
                timeDistribution[hourIndex].puts.push(tradeData);
            }
        });

        res.json(timeDistribution);
    } catch (error) {
        console.error(`Error fetching time distribution for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch time distribution', error });
    }
});

module.exports = router;
