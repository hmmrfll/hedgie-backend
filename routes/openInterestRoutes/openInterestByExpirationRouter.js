const express = require('express');
const axios = require('axios');
const pool = require('../../config/database');
const router = express.Router();

let conversionCache = {};

const getTableName = (exchange, asset) => {
    const exchangeTables = {
        OKX: {
            btc: 'okx_btc_trades',
            eth: 'okx_eth_trades',
        },
        DER: {
            btc: 'all_btc_trades',
            eth: 'all_eth_trades',
        },
    };

    return exchangeTables[exchange]?.[asset.toLowerCase()] || null;
};

async function getConversionRate(assetSymbol) {
    const now = Date.now();
    const cacheExpiration = 10 * 60 * 1000;

    if (conversionCache[assetSymbol] && (now - conversionCache[assetSymbol].timestamp < cacheExpiration)) {
        return conversionCache[assetSymbol].rate;
    }

    const conversionResponse = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${assetSymbol}&vs_currencies=usd`);
    const conversionRate = conversionResponse.data[assetSymbol].usd;

    conversionCache[assetSymbol] = {
        rate: conversionRate,
        timestamp: now
    };

    return conversionRate;
}

const convertToISODate = (dateStr) => {
    const year = `20${dateStr.slice(-2)}`;
    const monthStr = dateStr.slice(-5, -2).toUpperCase();
    let day = dateStr.slice(0, dateStr.length - 5);

    const monthMap = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };

    const month = monthMap[monthStr];
    if (!month) {
        console.error(`Ошибка: не удалось найти месяц для строки: ${dateStr}`);
        return null;
    }

    if (day.length === 1) {
        day = `0${day}`;
    }

    return `${year}-${month}-${day}`;
};

router.get('/open-interest-by-expiration/:asset/:strike', async (req, res) => {
    const { asset, strike } = req.params;
    const { exchange } = req.query;

    const assetSymbol = asset.toLowerCase() === 'btc' ? 'bitcoin' : 'ethereum';
    const tableName = getTableName(exchange, asset);
    if (!tableName) {
        console.error('Invalid exchange or asset specified');
        return res.status(400).json({ message: 'Invalid exchange or asset specified' });
    }
    try {
        const conversionRate = await getConversionRate(assetSymbol);

        const strikeCondition = strike === 'all' ? '' : `AND instrument_name LIKE '%-${strike}-%'`;

        // Используем 'amount' для OKX и 'contracts' для DER
        const contractField = exchange === 'OKX' ? 'amount' : 'contracts';

        const result = await pool.query(`
            SELECT 
                instrument_name,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN ${contractField} ELSE 0 END) AS puts_otm,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN ${contractField} ELSE 0 END) AS calls_otm,
                SUM(CASE WHEN instrument_name LIKE '%P' THEN ${contractField} * mark_price ELSE 0 END) AS puts_market_value,
                SUM(CASE WHEN instrument_name LIKE '%C' THEN ${contractField} * mark_price ELSE 0 END) AS calls_market_value,
                SUM(${contractField} * mark_price) AS notional_value
            FROM ${tableName}
            WHERE 1=1
            ${strikeCondition}
            GROUP BY instrument_name
            ORDER BY instrument_name;
        `);

        const groupedData = {};

        result.rows.forEach(row => {
            const match = row.instrument_name.match(/(\d{1,2}[A-Z]{3}\d{2})/);
            const expirationDate = match ? match[1] : null;
            if (expirationDate) {
                if (!groupedData[expirationDate]) {
                    groupedData[expirationDate] = {
                        puts_otm: 0,
                        calls_otm: 0,
                        puts_market_value: 0,
                        calls_market_value: 0,
                        notional_value: 0,
                    };
                }

                groupedData[expirationDate].puts_otm += parseFloat(row.puts_otm);
                groupedData[expirationDate].calls_otm += parseFloat(row.calls_otm);
                groupedData[expirationDate].puts_market_value += parseFloat(row.puts_market_value) * conversionRate;
                groupedData[expirationDate].calls_market_value += parseFloat(row.calls_market_value) * conversionRate;
                groupedData[expirationDate].notional_value += parseFloat(row.notional_value) * conversionRate;
            }
        });

        Object.keys(groupedData).forEach(expiration => {
            groupedData[expiration].puts_otm = groupedData[expiration].puts_otm.toFixed(2);
            groupedData[expiration].calls_otm = groupedData[expiration].calls_otm.toFixed(2);
            groupedData[expiration].puts_market_value = groupedData[expiration].puts_market_value.toFixed(2);
            groupedData[expiration].calls_market_value = groupedData[expiration].calls_market_value.toFixed(2);
            groupedData[expiration].notional_value = groupedData[expiration].notional_value.toFixed(2);
        });

        const currentDate = new Date();
        const filteredGroupedData = Object.keys(groupedData)
            .filter(expiration => new Date(convertToISODate(expiration)) >= currentDate)
            .reduce((filteredObj, key) => {
                filteredObj[key] = groupedData[key];
                return filteredObj;
            }, {});

        const sortedGroupedData = Object.keys(filteredGroupedData)
            .sort((a, b) => new Date(convertToISODate(a)) - new Date(convertToISODate(b)))
            .reduce((sortedObj, key) => {
                sortedObj[key] = filteredGroupedData[key];
                return sortedObj;
            }, {});

        res.json(sortedGroupedData);
    } catch (error) {
        console.error('Ошибка при получении данных об открытых интересах:', error.message);
        res.status(500).json({ message: 'Failed to fetch open interest data', error });
    }
});

module.exports = router;
