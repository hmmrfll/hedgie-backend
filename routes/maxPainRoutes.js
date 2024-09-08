const express = require('express');
const axios = require('axios');
const { calculateMaxPain } = require('../services/maxPainLogic');
const pool = require('../config/database'); // Подключение к базе данных

const router = express.Router();

// Роут для проверки и получения данных
router.get('/max-pain-data', async (req, res) => {
    const { currency } = req.query;

    try {
        console.log(`Received request for Max Pain data: Currency - ${currency}`);

        // Выбираем таблицу в зависимости от актива
        let tableName;
        if (currency.toLowerCase() === 'btc') {
            tableName = 'max_pain_data_btc';
        } else if (currency.toLowerCase() === 'eth') {
            tableName = 'max_pain_data_eth';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid currency' });
        }

        // Проверяем, есть ли данные в соответствующей таблице
        const dbResult = await pool.query(
            `SELECT * FROM ${tableName} WHERE currency = $1 ORDER BY timestamp DESC LIMIT 1`,
            [currency.toLowerCase()]
        );

        // Если данные найдены, возвращаем их
        if (dbResult.rows.length > 0) {
            console.log('Returning data from database', dbResult.rows[0]);
            return res.json(dbResult.rows[0]);
        }

        // Если данных нет, делаем запрос к Deribit
        console.log('No data in database. Fetching from Deribit...');
        const response = await axios.get(
            `https://deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`
        );

        const optionsData = response.data.result.map(option => ({
            strike_price: parseFloat(option.instrument_name.split('-')[2]),
            open_interest: parseFloat(option.open_interest),
            option_type: option.instrument_name.split('-')[3] // "C" или "P"
        }));

        console.log('Options Data:', optionsData);

        // Рассчитываем Max Pain
        const { maxPain, intrinsicValues } = calculateMaxPain(optionsData);

        console.log('Max Pain Calculation Result:', { maxPain, intrinsicValues });

        // Сохраняем данные в соответствующую таблицу
        const insertQuery = `
            INSERT INTO ${tableName} (currency, max_pain, intrinsic_values, timestamp)
            VALUES ($1, $2, $3, NOW())
        `;
        await pool.query(insertQuery, [currency.toLowerCase(), maxPain, JSON.stringify(intrinsicValues)]);

        console.log('Data saved to database and returned.');
        res.json({ maxPain, intrinsicValues });
    } catch (error) {
        console.error('Error fetching Max Pain data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch Max Pain data', error: error.message });
    }
});

module.exports = router;
