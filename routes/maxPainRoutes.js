const express = require('express');
const axios = require('axios');
const { calculateMaxPain } = require('../services/maxPainLogic');
const pool = require('../config/database');

const router = express.Router();

let lastUpdateTime = null;

const extractExpiration = (instrumentName) => {
    const parts = instrumentName.split('-');
    if (parts.length >= 2) {
        return parts[1];
    } else {
        throw new Error(`Невозможно извлечь дату экспирации из ${instrumentName}`);
    }
};

const isDataStale = () => {
    if (!lastUpdateTime) return true;

    const now = new Date();
    const hoursDifference = Math.abs(now - lastUpdateTime) / 36e5;

    return hoursDifference > 24;
};

router.get('/max-pain-data', async (req, res) => {
    const { currency } = req.query;

    try {

        let tableName;
        if (currency.toLowerCase() === 'btc') {
            tableName = 'max_pain_data_btc';
        } else if (currency.toLowerCase() === 'eth') {
            tableName = 'max_pain_data_eth';
        } else {
            return res.status(400).json({ success: false, message: 'Неверная валюта' });
        }

        if (!isDataStale()) {
            const existingDataQuery = `SELECT expiration_date, max_pain, intrinsic_values FROM ${tableName}`;
            const result = await pool.query(existingDataQuery);
            const maxPainByExpiration = {};
            result.rows.forEach(row => {
                maxPainByExpiration[row.expiration_date] = {
                    maxPain: row.max_pain,
                    intrinsicValues: typeof row.intrinsic_values === 'string'
                        ? JSON.parse(row.intrinsic_values)
                        : row.intrinsic_values
                };
            });

            return res.json({ maxPainByExpiration });
        }

        const response = await axios.get(
            `https://deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`
        );

        const optionsDataByExpiration = {};
        response.data.result.forEach(option => {
            const expiration = extractExpiration(option.instrument_name);
            const strikePrice = parseFloat(option.instrument_name.split('-')[2]);
            const openInterest = parseFloat(option.open_interest);
            const optionType = option.instrument_name.split('-')[3];

            if (!optionsDataByExpiration[expiration]) {
                optionsDataByExpiration[expiration] = [];
            }
            optionsDataByExpiration[expiration].push({
                strike_price: strikePrice,
                open_interest: openInterest,
                option_type: optionType
            });
        });

        const maxPainByExpiration = {};
        await pool.query(`DELETE FROM ${tableName}`);
        for (const expiration in optionsDataByExpiration) {
            const { maxPain, intrinsicValues } = calculateMaxPain(optionsDataByExpiration[expiration]);
            maxPainByExpiration[expiration] = { maxPain, intrinsicValues };
            const insertQuery = `
                INSERT INTO ${tableName} (expiration_date, max_pain, intrinsic_values)
                VALUES ($1, $2, $3)
            `;
            await pool.query(insertQuery, [
                expiration,
                maxPain,
                JSON.stringify(intrinsicValues)
            ]);
        }

        lastUpdateTime = new Date();
        res.json({ maxPainByExpiration });
    } catch (error) {
        console.error('Ошибка при расчете Max Pain:', error);
        res.status(500).json({ success: false, message: 'Не удалось рассчитать Max Pain', error: error.message });
    }
});

module.exports = router;
