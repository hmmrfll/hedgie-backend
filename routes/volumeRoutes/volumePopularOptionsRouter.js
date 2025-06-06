const express = require('express');
const pool = require('../../cmd/db');
const router = express.Router();

router.get('/popular-options/:currency', async (req, res) => {
	const { currency } = req.params;
	const { type } = req.query;

	let tradesTable;
	if (currency.toLowerCase() === 'btc') {
		tradesTable = type === 'block' ? 'btc_block_trades' : 'all_btc_trades';
	} else if (currency.toLowerCase() === 'eth') {
		tradesTable = type === 'block' ? 'eth_block_trades' : 'all_eth_trades';
	} else {
		return res.status(400).json({ message: 'Invalid currency' });
	}

	try {
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
