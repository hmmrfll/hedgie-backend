const pool = require('../config/database');

exports.getBTCMetrics = async (req, res) => {
    try {
        console.log('Received request for BTC metrics');

        const result = await pool.query(`
            SELECT 
                SUM(CASE WHEN instrument_name LIKE '%-C' AND direction = 'buy' THEN amount ELSE 0 END) AS "Call_Buys",
                SUM(CASE WHEN instrument_name LIKE '%-C' AND direction = 'sell' THEN amount ELSE 0 END) AS "Call_Sells",
                SUM(CASE WHEN instrument_name LIKE '%-P' AND direction = 'buy' THEN amount ELSE 0 END) AS "Put_Buys",
                SUM(CASE WHEN instrument_name LIKE '%-P' AND direction = 'sell' THEN amount ELSE 0 END) AS "Put_Sells"
            FROM 
                all_btc_trades
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours';
        `);

        console.log('Query result:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching BTC metrics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch BTC metrics' });
    }
};

exports.getETHMetrics = async (req, res) => {
    try {
        console.log('Received request for ETH metrics');

        const result = await pool.query(`
            SELECT 
                SUM(CASE WHEN instrument_name LIKE '%-C' AND direction = 'buy' THEN amount ELSE 0 END) AS "Call_Buys",
                SUM(CASE WHEN instrument_name LIKE '%-C' AND direction = 'sell' THEN amount ELSE 0 END) AS "Call_Sells",
                SUM(CASE WHEN instrument_name LIKE '%-P' AND direction = 'buy' THEN amount ELSE 0 END) AS "Put_Buys",
                SUM(CASE WHEN instrument_name LIKE '%-P' AND direction = 'sell' THEN amount ELSE 0 END) AS "Put_Sells"
            FROM 
                all_eth_trades
            WHERE 
                timestamp >= NOW() - INTERVAL '24 hours';
        `);

        console.log('Query result:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching ETH metrics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch ETH metrics' });
    }
};
