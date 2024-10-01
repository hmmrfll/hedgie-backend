const express = require('express');
const axios = require('axios');
const pool = require('../../config/database');
const router = express.Router();

let conversionCache = {};

// Функция получения курса конверсии с кэшированием
async function getConversionRate(assetSymbol) {
    const now = Date.now();
    const cacheExpiration = 10 * 60 * 1000; // Время жизни кеша 10 минут

    if (conversionCache[assetSymbol] && (now - conversionCache[assetSymbol].timestamp < cacheExpiration)) {
        return conversionCache[assetSymbol].rate; // Возвращаем кешированные данные
    }

    // Получаем курс через CoinGecko API
    const conversionResponse = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${assetSymbol}&vs_currencies=usd`);
    const conversionRate = conversionResponse.data[assetSymbol].usd;

    conversionCache[assetSymbol] = {
        rate: conversionRate,
        timestamp: now
    };

    return conversionRate;
}

// Маршрут для получения данных об открытых интересах
router.get('/open-interest-by-expiration/:asset/:strike', async (req, res) => {
    const { asset, strike } = req.params;
    const assetSymbol = asset.toLowerCase() === 'btc' ? 'bitcoin' : 'ethereum';
    try {
        // Получаем курс актива к доллару с кэшированием
        const conversionRate = await getConversionRate(assetSymbol);

        // Получаем активные даты экспирации
        const response = await axios.get(`http://localhost:${process.env.PORT}/api/expirations/${asset.toLowerCase()}`);
        const activeExpirations = response.data;

        if (!activeExpirations || activeExpirations.length === 0) {
            return res.status(400).json({ message: 'No active expirations found.' });
        }

        const activeExpirationsCondition = activeExpirations.map(exp => `instrument_name LIKE '%-${exp}-%'`).join(' OR ');
        const strikeCondition = strike === 'all' ? '' : `AND instrument_name LIKE '%-${strike}-%'`;

        const result = await pool.query(`
            SELECT 
                substring(instrument_name from '[0-9]{2}[A-Z]{3}[0-9]{2}') AS expiration,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts ELSE 0 END) AS puts_otm,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts ELSE 0 END) AS calls_otm,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts * mark_price ELSE 0 END) AS calls_market_value,
                SUM(contracts * mark_price) AS notional_value
            FROM ${asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades'}
            WHERE (${activeExpirationsCondition})
            ${strikeCondition}
            GROUP BY expiration
            ORDER BY expiration;
        `);

        const convertedData = result.rows.map(row => ({
            ...row,
            puts_market_value: (parseFloat(row.puts_market_value) * conversionRate).toFixed(2),
            calls_market_value: (parseFloat(row.calls_market_value) * conversionRate).toFixed(2),
            notional_value: (parseFloat(row.notional_value) * conversionRate).toFixed(2)
        }));

        res.json(convertedData);
    } catch (error) {
        console.error('Ошибка при получении данных об открытых интересах:', error.message);
        res.status(500).json({ message: 'Failed to fetch open interest data', error });
    }
});

module.exports = router;
