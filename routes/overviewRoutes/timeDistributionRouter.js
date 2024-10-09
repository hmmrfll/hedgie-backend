const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/time-distribution/:currency', async (req, res) => {
    const { currency } = req.params;
    const { timeRange } = req.query; // Получаем параметр временного интервала из запроса

    let interval = '24 hours'; // По умолчанию - последние 24 часа

    // Определяем интервал времени на основе выбора пользователя
    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    // Определение таблицы в зависимости от валюты
    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        // Запрос данных за выбранный интервал времени с группировкой по timestamp
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

        // Получаем текущий час
        const currentHour = new Date().getUTCHours();

        // Инициализация массива на 24 часа, начиная с текущего часа
        const timeDistribution = Array.from({ length: 24 }, (_, i) => ({
            hour: (currentHour - i + 24) % 24,  // Часы от текущего времени
            calls: [],
            puts: []
        }));

        // Обработка каждой сделки и группировка по часам
        result.rows.forEach(row => {
            const tradeHour = new Date(row.timestamp).getUTCHours(); // Час сделки
            const tradeData = {
                trade_count: row.trade_count,
                avg_index_price: row.avg_index_price,
                type: row.instrument_name.includes('-C') ? 'call' : 'put',  // Определение Call или Put
                direction: row.direction,
            };

            // Рассчитываем индекс для корректной группировки по часам
            const index = (currentHour - tradeHour + 24) % 24;

            // Группировка по типу сделки (Call/Put)
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

