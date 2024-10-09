const express = require('express');
const pool = require('../../config/database');
const router = express.Router();

router.get('/strike-activity/:currency', async (req, res) => {
    const { currency } = req.params;
    const { expiration, timeRange } = req.query; // Получаем параметры временного интервала и экспирации

    let interval = '24 hours'; // По умолчанию - последние 24 часа

    // Определяем интервал на основе выбранного времени
    if (timeRange === '7d') {
        interval = '7 days';
    } else if (timeRange === '30d') {
        interval = '30 days';
    }

    const tableName = currency.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades';

    try {
        let query = `
            SELECT 
                instrument_name, 
                COUNT(*) AS trade_count
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
        `;

        // Фильтрация по дате экспирации, если она выбрана
        if (expiration && expiration !== 'All Expirations') {
            query += ` AND instrument_name LIKE '%${expiration.replace(/\s+/g, '').toUpperCase()}%'`;
        }

        query += `
            GROUP BY 
                instrument_name
            ORDER BY 
                trade_count DESC;
        `;

        const result = await pool.query(query);

        // Создаем объект для агрегации данных по страйкам и типам опционов
        const aggregatedData = {};

        result.rows.forEach(row => {
            const match = row.instrument_name.match(/(\d+)-([CP])$/); // Извлекаем страйк и тип опциона (C/P)
            const strike_price = match ? parseInt(match[1], 10) : null;
            const option_type = match ? match[2] : null;

            if (strike_price && option_type) {
                const key = `${strike_price}-${option_type}`;

                // Если страйк уже существует, добавляем к существующему количеству сделок
                if (aggregatedData[key]) {
                    aggregatedData[key].trade_count += parseInt(row.trade_count, 10);
                } else {
                    aggregatedData[key] = {
                        strike_price,
                        option_type,
                        trade_count: parseInt(row.trade_count, 10),
                    };
                }
            }
        });

        // Преобразуем объект в массив для отправки на фронт
        const dataWithStrike = Object.values(aggregatedData);

        res.json(dataWithStrike);
    } catch (error) {
        console.error(`Error fetching strike activity for ${currency}:`, error);
        res.status(500).json({ message: 'Failed to fetch strike activity', error });
    }
});

module.exports = router;
