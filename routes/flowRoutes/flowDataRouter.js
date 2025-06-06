const express = require('express');
const pool = require('../../cmd/db');
const router = express.Router();

router.get('/trades', async (req, res) => {
	const { asset, tradeType, optionType, expiration, sizeOrder, premiumOrder, limit = 25, page = 1 } = req.query;

	let tableName = asset === 'BTC' ? 'all_btc_trades' : 'all_eth_trades';
	const offset = (page - 1) * limit;

	let query = `
        SELECT
            *,
            TO_CHAR(timestamp, 'HH24:MI:SS') AS time_only
        FROM ${tableName}
        WHERE 1=1
    `;

	let countQuery = `
        SELECT COUNT(*) AS total
        FROM ${tableName}
        WHERE 1=1
    `;

	if (tradeType && tradeType !== 'Buy/Sell') {
		query += ` AND direction = '${tradeType.toLowerCase()}'`;
		countQuery += ` AND direction = '${tradeType.toLowerCase()}'`;
	}

	if (optionType && optionType !== 'Call/Put') {
		const optionFilter = optionType === 'Call' ? '-C' : '-P';
		query += ` AND instrument_name LIKE '%${optionFilter}'`;
		countQuery += ` AND instrument_name LIKE '%${optionFilter}'`;
	}

	if (expiration && expiration !== 'All Expirations') {
		query += ` AND instrument_name LIKE '%${expiration}%'`;
		countQuery += ` AND instrument_name LIKE '%${expiration}%'`;
	}

	if (sizeOrder && sizeOrder !== 'All Sizes') {
		if (sizeOrder === 'higher to lower') {
			query += ` ORDER BY amount DESC`;
		} else if (sizeOrder === 'lesser to greater') {
			query += ` ORDER BY amount ASC`;
		} else if (sizeOrder === 'low') {
			query += ` AND amount < (SELECT AVG(amount) FROM ${tableName})`;
		} else if (sizeOrder === 'high') {
			query += ` AND amount > (SELECT AVG(amount) FROM ${tableName})`;
		}
	}

	if (premiumOrder && premiumOrder !== 'All Premiums') {
		if (sizeOrder === 'All Sizes') {
			if (premiumOrder === 'higher to lower') {
				query += ` ORDER BY price DESC`;
			} else if (premiumOrder === 'lesser to greater') {
				query += ` ORDER BY price ASC`;
			}
		} else {
			if (premiumOrder === 'higher to lower') {
				query += `, price DESC`;
			} else if (premiumOrder === 'lesser to greater') {
				query += `, price ASC`;
			}
		}

		if (premiumOrder === 'low') {
			query += ` AND price < (SELECT AVG(price) FROM ${tableName})`;
		} else if (premiumOrder === 'high') {
			query += ` AND price > (SELECT AVG(price) FROM ${tableName})`;
		}
	}

	if (!sizeOrder || sizeOrder === 'All Sizes') {
		if (!premiumOrder || premiumOrder === 'All Premiums') {
			query += ` ORDER BY timestamp DESC`;
		}
	}

	query += ` LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;

	try {
		const result = await pool.query(query);
		const trades = result.rows;

		const countResult = await pool.query(countQuery);
		const totalRows = parseInt(countResult.rows[0].total, 10);
		const totalPages = Math.ceil(totalRows / limit);

		if (trades.length === 0) {
			return res.json({
				trades: [],
				putCallRatio: 0,
				totalPuts: 0,
				totalCalls: 0,
				putsPercentage: 0,
				callsPercentage: 0,
				totalPages,
			});
		}

		const metricsQuery = `
    SELECT
        SUM(CASE WHEN instrument_name LIKE '%-C' THEN amount ELSE 0 END) AS total_calls,
        SUM(CASE WHEN instrument_name LIKE '%-P' THEN amount ELSE 0 END) AS total_puts
    FROM ${tableName}
    WHERE timestamp >= NOW() - INTERVAL '24 HOURS'
`;

		const metricsResult = await pool.query(metricsQuery);
		const { total_calls, total_puts } = metricsResult.rows[0];

		const putCallRatio = total_calls !== 0 ? total_puts / total_calls : 0;
		const total = Number(total_calls) + Number(total_puts);
		const putsPercentage = total !== 0 ? (total_puts / total) * 100 : 0;
		const callsPercentage = total !== 0 ? (total_calls / total) * 100 : 0;

		res.json({
			trades,
			putCallRatio,
			totalPuts: total_puts,
			totalCalls: total_calls,
			putsPercentage,
			callsPercentage,
			totalPages,
		});
	} catch (error) {
		console.error('Error fetching trades:', error);
		res.status(500).json({ message: 'Failed to fetch trades', error });
	}
});

module.exports = router;
