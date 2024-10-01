const express = require('express');
const axios = require('axios');
const pool = require('../../config/database');
const router = express.Router();

let conversionCache = {};

// Функция для получения курса конверсии с кэшированием
async function getConversionRate(assetSymbol) {
    const now = Date.now();
    const cacheExpiration = 10 * 60 * 1000; // 10 минут кэша

    if (conversionCache[assetSymbol] && (now - conversionCache[assetSymbol].timestamp < cacheExpiration)) {
        return conversionCache[assetSymbol].rate; // Вернуть данные из кеша
    }

    // Запрос курса валют через CoinGecko API
    const conversionResponse = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${assetSymbol}&vs_currencies=usd`);
    const conversionRate = conversionResponse.data[assetSymbol].usd;

    conversionCache[assetSymbol] = {
        rate: conversionRate,
        timestamp: now
    };

    return conversionRate;
}

router.get('/open-interest-by-expiration/:asset/:strike', async (req, res) => {
    const { asset, strike } = req.params;
    const assetSymbol = asset.toLowerCase() === 'btc' ? 'bitcoin' : 'ethereum';

    try {
        // Получаем курс валюты актива в доллары
        const conversionRate = await getConversionRate(assetSymbol);

        // Условие для фильтрации страйков
        const strikeCondition = strike === 'all' ? '' : `AND instrument_name LIKE '%-${strike}-%'`;

        // SQL-запрос для получения данных об открытых интересах
        const query = `
            SELECT 
                substring(instrument_name from '[0-9]{2}[A-Z]{3}[0-9]{2}') AS expiration,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts ELSE 0 END) AS puts_otm,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts ELSE 0 END) AS calls_otm,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts * mark_price ELSE 0 END) AS calls_market_value,
                SUM(contracts * mark_price) AS notional_value
            FROM ${asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades'}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ${strikeCondition}
            GROUP BY expiration
            ORDER BY expiration;
        `;

        const result = await pool.query(query);

        // Конвертируем значения в доллары США
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
