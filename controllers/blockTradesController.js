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

        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Error fetching ${tableName} metrics:`, error);
        res.status(500).json({ success: false, message: `Failed to fetch ${tableName} metrics` });
    }
};

module.exports = {
    getBlockTrades,
};
