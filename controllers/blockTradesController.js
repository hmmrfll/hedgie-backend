const pool = require('../config/database');  // Файл для подключения к БД

const getBlockTrades = async (tableName, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                SUM(CASE WHEN instrument_name LIKE '%-C' AND direction = 'buy' THEN amount ELSE 0 END) AS "Call_Buys",
                SUM(CASE WHEN instrument_name LIKE '%-C' AND direction = 'sell' THEN amount ELSE 0 END) AS "Call_Sells",
                SUM(CASE WHEN instrument_name LIKE '%-P' AND direction = 'buy' THEN amount ELSE 0 END) AS "Put_Buys",
                SUM(CASE WHEN instrument_name LIKE '%-P' AND direction = 'sell' THEN amount ELSE 0 END) AS "Put_Sells"
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours';
        `);

        const metrics = result.rows[0];

        // Преобразуем строки в числа
        const callBuys = parseFloat(metrics.Call_Buys) || 0;
        const callSells = parseFloat(metrics.Call_Sells) || 0;
        const putBuys = parseFloat(metrics.Put_Buys) || 0;
        const putSells = parseFloat(metrics.Put_Sells) || 0;

        // Вычисляем общую сумму всех метрик
        const total = callBuys + callSells + putBuys + putSells;

        // Рассчитываем проценты для каждой метрики
        const response = {
            Call_Buys: callBuys,
            Call_Sells: callSells,
            Put_Buys: putBuys,
            Put_Sells: putSells,
            Call_Buys_Percent: total > 0 ? ((callBuys / total) * 100).toFixed(2) : '0.00',
            Call_Sells_Percent: total > 0 ? ((callSells / total) * 100).toFixed(2) : '0.00',
            Put_Buys_Percent: total > 0 ? ((putBuys / total) * 100).toFixed(2) : '0.00',
            Put_Sells_Percent: total > 0 ? ((putSells / total) * 100).toFixed(2) : '0.00'
        };

        console.log(`Query result with percentages for ${tableName}:`, response);

        res.json(response);
    } catch (error) {
        console.error(`Error fetching ${tableName} metrics:`, error);
        res.status(500).json({ success: false, message: `Failed to fetch ${tableName} metrics` });
    }
};

module.exports = {
    getBlockTrades,
};
