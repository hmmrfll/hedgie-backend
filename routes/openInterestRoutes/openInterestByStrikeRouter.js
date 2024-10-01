const express = require('express');
const pool = require('../../config/database');
const axios = require('axios');
const router = express.Router();

let cachedRate = null;
let lastFetchedTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 минут в миллисекундах

// Функция для получения курса валюты BTC или ETH к USD с кэшированием
async function getConversionRate(asset) {
    const now = Date.now();

    // Проверка на наличие кэшированных данных и их актуальность
    if (cachedRate && (now - lastFetchedTime) < CACHE_TTL) {
        return cachedRate[asset.toLowerCase()];
    }

    // Получаем курс валюты с CoinGecko
    const btcUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
    const ethUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

    const [btcResponse, ethResponse] = await Promise.all([
        axios.get(btcUrl),
        axios.get(ethUrl)
    ]);

    // Сохраняем курсы в кэш
    cachedRate = {
        btc: btcResponse.data.bitcoin.usd,
        eth: ethResponse.data.ethereum.usd
    };
    lastFetchedTime = now;

    return cachedRate[asset.toLowerCase()];
}

router.get('/open-interest-by-strike/:asset/:expiration', async (req, res) => {
    const { asset, expiration } = req.params;
    try {
        // Получаем курс валюты (BTC или ETH) в долларах США
        const conversionRate = await getConversionRate(asset);

        // Условие для фильтрации по дате экспирации
        const expirationCondition = expiration === 'all' ? '' : `WHERE instrument_name LIKE '%${expiration}%'`;

        const query = `
            SELECT 
                CAST(SUBSTRING(instrument_name FROM '-([0-9]+)-[PC]$') AS INTEGER) AS strike,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts ELSE 0 END) AS puts,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts ELSE 0 END) AS calls,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN contracts * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN contracts * mark_price ELSE 0 END) AS calls_market_value
            FROM ${asset.toLowerCase() === 'btc' ? 'all_btc_trades' : 'all_eth_trades'}
            ${expirationCondition} -- Условие на основе даты истечения в имени инструмента
            GROUP BY strike
            ORDER BY strike;
        `;

        const result = await pool.query(query);

        // Преобразование рыночной стоимости в доллары США
        const data = result.rows.map(row => ({
            strike: row.strike,
            puts: row.puts,
            calls: row.calls,
            puts_market_value: (row.puts_market_value * conversionRate).toFixed(2), // Конвертация в доллары
            calls_market_value: (row.calls_market_value * conversionRate).toFixed(2), // Конвертация в доллары
        }));

        res.json(data);
    } catch (error) {
        console.error(`Error fetching open interest by strike for ${asset}:`, error);
        res.status(500).json({ message: 'Failed to fetch open interest data', error });
    }
});

module.exports = router;
