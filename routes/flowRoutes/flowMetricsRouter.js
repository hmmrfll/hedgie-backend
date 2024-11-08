const express = require('express');
const pool = require('../../config/database');
const router = express.Router();
let cachedMetrics = {
    BTC: null,
    ETH: null,
};
let lastUpdated = {
    BTC: null,
    ETH: null,
};

async function fetchMetrics(asset) {
    const tableName = asset === 'BTC' ? 'all_btc_trades' : 'all_eth_trades';

    const query = `
        SELECT 
            SUM(CASE WHEN instrument_name LIKE '%-C' THEN amount ELSE 0 END) AS total_calls,
            SUM(CASE WHEN instrument_name LIKE '%-P' THEN amount ELSE 0 END) AS total_puts
        FROM ${tableName};
    `;

    const result = await pool.query(query);

    const totalCalls = result.rows[0].total_calls || 0;
    const totalPuts = result.rows[0].total_puts || 0;
    const putCallRatio = totalCalls > 0 ? totalPuts / totalCalls : 0;

    return {
        totalCalls,
        totalPuts,
        putCallRatio,
        callsPercentage: totalCalls / (totalCalls + totalPuts) * 100,
        putsPercentage: totalPuts / (totalCalls + totalPuts) * 100,
    };
}

router.get('/metrics', async (req, res) => {
    const { asset } = req.query;

    if (!asset || !['BTC', 'ETH'].includes(asset)) {
        return res.status(400).json({ message: 'Invalid or missing asset. Must be BTC or ETH.' });
    }

    const currentTime = Date.now();

    if (!cachedMetrics[asset] || currentTime - lastUpdated[asset] > 60 * 60 * 1000) {
        try {
            cachedMetrics[asset] = await fetchMetrics(asset);
            lastUpdated[asset] = currentTime;
        } catch (error) {
            console.error(`Error fetching metrics for ${asset}:`, error);
            return res.status(500).json({ message: 'Failed to fetch metrics' });
        }
    }

    res.json(cachedMetrics[asset]);
});

module.exports = router;
