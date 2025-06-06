const pool = require('../cmd/db');

exports.getBTCMetrics = async (req, res) => {
	const { timeRange, exchange } = req.query;
	let interval = '24 hours';

	// Установка интервала времени в зависимости от параметра timeRange
	if (timeRange === '7d') {
		interval = '7 days';
	} else if (timeRange === '30d') {
		interval = '30 days';
	}

	// Выбор таблицы в зависимости от биржи
	const tableName = exchange === 'OKX' ? 'okx_btc_trades' : 'all_btc_trades';

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
                timestamp >= NOW() - INTERVAL '${interval}';
        `);

		const metrics = result.rows[0];

		const callBuys = parseFloat(metrics.Call_Buys) || 0;
		const callSells = parseFloat(metrics.Call_Sells) || 0;
		const putBuys = parseFloat(metrics.Put_Buys) || 0;
		const putSells = parseFloat(metrics.Put_Sells) || 0;
		const total = callBuys + callSells + putBuys + putSells;

		const response = {
			Call_Buys: callBuys,
			Call_Sells: callSells,
			Put_Buys: putBuys,
			Put_Sells: putSells,
			Call_Buys_Percent: total > 0 ? ((callBuys / total) * 100).toFixed(2) : '0.00',
			Call_Sells_Percent: total > 0 ? ((callSells / total) * 100).toFixed(2) : '0.00',
			Put_Buys_Percent: total > 0 ? ((putBuys / total) * 100).toFixed(2) : '0.00',
			Put_Sells_Percent: total > 0 ? ((putSells / total) * 100).toFixed(2) : '0.00',
		};

		res.json(response);
	} catch (error) {
		console.error('Error fetching BTC metrics:', error);
		res.status(500).json({ success: false, message: 'Failed to fetch BTC metrics' });
	}
};

exports.getETHMetrics = async (req, res) => {
	const { timeRange, exchange } = req.query;
	let interval = '24 hours';

	if (timeRange === '7d') {
		interval = '7 days';
	} else if (timeRange === '30d') {
		interval = '30 days';
	}

	// Выбор таблицы в зависимости от биржи
	const tableName = exchange === 'OKX' ? 'okx_eth_trades' : 'all_eth_trades';

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
                timestamp >= NOW() - INTERVAL '${interval}';
        `);

		const metrics = result.rows[0];

		const callBuys = parseFloat(metrics.Call_Buys) || 0;
		const callSells = parseFloat(metrics.Call_Sells) || 0;
		const putBuys = parseFloat(metrics.Put_Buys) || 0;
		const putSells = parseFloat(metrics.Put_Sells) || 0;
		const total = callBuys + callSells + putBuys + putSells;

		const response = {
			Call_Buys: callBuys,
			Call_Sells: callSells,
			Put_Buys: putBuys,
			Put_Sells: putSells,
			Call_Buys_Percent: total > 0 ? ((callBuys / total) * 100).toFixed(2) : '0.00',
			Call_Sells_Percent: total > 0 ? ((callSells / total) * 100).toFixed(2) : '0.00',
			Put_Buys_Percent: total > 0 ? ((putBuys / total) * 100).toFixed(2) : '0.00',
			Put_Sells_Percent: total > 0 ? ((putSells / total) * 100).toFixed(2) : '0.00',
		};

		res.json(response);
	} catch (error) {
		console.error('Error fetching ETH metrics:', error);
		res.status(500).json({ success: false, message: 'Failed to fetch ETH metrics' });
	}
};
