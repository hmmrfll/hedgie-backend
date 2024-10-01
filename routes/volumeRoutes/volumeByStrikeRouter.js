const express = require('express');
const pool = require('../../config/database');
const axios = require('axios');
const router = express.Router();

let cache = {}; // Простой объект для кэширования данных
const CACHE_EXPIRY = 300000; // Время жизни кэша: 5 минут (300000 миллисекунд)

// Функция для получения курса конверсии валюты
async function getConversionRate(asset) {
    const cacheKey = `conversionRate_${asset}`;

    // Проверяем наличие курса в кэше
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_EXPIRY)) {
        return cache[cacheKey].rate; // Возвращаем курс из кэша, если не истек срок
    }

    // Выполняем запрос к API для получения курса
    const url = asset.toLowerCase() === 'btc'
        ? 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
        : 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

    const response = await axios.get(url);
    const rate = asset.toLowerCase() === 'btc'
        ? response.data.bitcoin.usd
        : response.data.ethereum.usd;

    // Сохраняем результат в кэш
    cache[cacheKey] = {
        rate,
        timestamp: Date.now(),
    };

    return rate;
}

router.get('/open-interest-by-strike/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;

    const cacheKey = `openInterest_${asset}_${expiration}`;
    try {
        // Проверяем кэш для данных открытого интереса
        if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_EXPIRY)) {
            return res.json(cache[cacheKey].data); // Возвращаем кэшированные данные
        }

        // Получаем курс валюты для конвертации
        const conversionRate = await getConversionRate(asset);

        // Условие для фильтрации по дате экспирации
        const expirationCondition = expiration === 'all' ? '' : `AND instrument_name LIKE '%${expiration}%'`;

        const query = `
            SELECT 
                CAST(SUBSTRING(instrument_name FROM '-([0-9]+)-[PC]$') AS INTEGER) AS strike,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts ELSE 0 END) AS puts,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts ELSE 0 END) AS calls,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts * mark_price ELSE 0 END) AS calls_market_value
            FROM ${asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades'}
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            ${expirationCondition}
            GROUP BY strike
            ORDER BY strike;
        `;

        const result = await pool.query(query);

        // Преобразование рыночных значений в доллары США
        const data = result.rows.map(row => ({
            strike: row.strike,
            puts: row.puts,
            calls: row.calls,
            puts_market_value: (row.puts_market_value * conversionRate).toFixed(2),
            calls_market_value: (row.calls_market_value * conversionRate).toFixed(2),
        }));

        // Сохраняем данные в кэш
        cache[cacheKey] = {
            data,
            timestamp: Date.now(),
        };

        res.json(data);
    } catch (error) {
        console.error(`Error fetching open interest by strike for ${asset}:`, error);
        res.status(500).json({ message: 'Failed to fetch open interest data', error });
    }
});

module.exports = router;
