const express = require('express');
const pool = require('../../config/database'); // Database connection
const moment = require('moment'); // For date manipulation
const router = express.Router();

const calculateDTE = (instrumentName) => {
    const expDate = instrumentName.split('-')[1]; // Format: 6SEP24
    const expDateFormatted = moment(expDate, 'DDMMMYY'); // Convert to date
    const now = moment();
    const dte = expDateFormatted.diff(now, 'days'); // Difference in days
    return dte >= 0 ? `${dte}d` : '0d'; // Return in format Xd
};

const determineMaker = (premium) => {
    if (premium < 250) return '🐙🦑';  // SHRIMP
    if (premium < 1000) return '🐟🎣';  // FISH
    if (premium < 10000) return '🐡🚣'; // CARP
    if (premium < 100000) return '🐬🌊'; // DOLPHIN
    if (premium < 1000000) return '🐋🐳'; // WHALE
    if (premium < 10000000) return '🦈'; // WHALE
    return 'Unknown';
};

router.get('/trades', async (req, res) => {
    const {
        asset = 'ALL',
        side = 'ALL',
        tradeType,
        optionType = 'ALL',
        expiration,
        sizeOrder,
        premiumOrder,
        page = 1,
        pageSize = 15,
        exchange,
        minStrike,
        maxStrike,
        maker,
        ivMin,
        ivMax,
        dteMin,
        dteMax,
    } = req.query;

    const parsedPageSize = parseInt(pageSize, 10) || 15;
    const parsedPage = parseInt(page, 10) || 1;
    const offset = (parsedPage - 1) * parsedPageSize;

    try {
        console.log('Received query parameters:', req.query);

        // Start building the SQL query
        let query = `
            SELECT 
                TO_CHAR(timestamp, 'HH24:MI:SS') AS timeUtc,
                direction AS side,
                instrument_name,
                RIGHT(instrument_name, 1) AS k,
                TO_CHAR(timestamp, 'YYYY-MM-DD') AS chain,
                index_price AS spot,
                amount AS size,
                price,
                iv,
                TO_DATE(SUBSTRING(instrument_name FROM '\\d+[A-Z]{3}\\d{2}'), 'DDMONYY') AS expiration_date,
                'Deribit' AS exchange
            FROM 
                ${asset === 'ALL' ? '(SELECT * FROM eth_block_trades UNION SELECT * FROM btc_block_trades)' : asset.toLowerCase() + '_block_trades'}
            WHERE 1=1
        `;

        // Add filters to the query
        if (optionType !== 'ALL') {
            query += ` AND RIGHT(instrument_name, 1) = '${optionType}'`;
        }
        if (minStrike) {
            query += ` AND CAST(REGEXP_SUBSTR(instrument_name, '\\d+(?=-[CP]$)') AS INTEGER) >= ${minStrike}`;
        }
        if (maxStrike) {
            query += ` AND CAST(REGEXP_SUBSTR(instrument_name, '\\d+(?=-[CP]$)') AS INTEGER) <= ${maxStrike}`;
        }
        if (ivMin) {
            query += ` AND iv >= ${ivMin}`;
        }
        if (ivMax) {
            query += ` AND iv <= ${ivMax}`;
        }
        if (dteMin) {
            query += ` AND (TO_DATE(SUBSTRING(instrument_name FROM '\\d+[A-Z]{3}\\d{2}'), 'DDMONYY') - CURRENT_DATE) >= ${dteMin}`;
        }
        if (dteMax) {
            query += ` AND (TO_DATE(SUBSTRING(instrument_name FROM '\\d+[A-Z]{3}\\d{2}'), 'DDMONYY') - CURRENT_DATE) <= ${dteMax}`;
        }
        if (side !== 'ALL') {
            query += ` AND direction = '${side.toLowerCase()}'`; // direction хранит BUY или SELL
        }

        console.log('Query with filters:', query);

        // Fetch all filtered trades
        const tradesResult = await pool.query(query);

        // Map the trades and calculate the maker
        let trades = tradesResult.rows.map((trade) => {
            const strike = trade.instrument_name.match(/\d+(?=-[CP]$)/);
            const dte = calculateDTE(trade.instrument_name);

            // Convert price and premium to dollar equivalents
            const priceInUSD = (parseFloat(trade.price) * parseFloat(trade.spot)).toFixed(2); // price * index_price
            const premiumInUSD = (parseFloat(trade.price) * parseFloat(trade.size) * parseFloat(trade.spot)).toFixed(2); // price * size * index_price

            const makerCalculated = determineMaker(parseFloat(premiumInUSD));

            return {
                ...trade,
                strike: strike ? strike[0] : null,
                dte,
                price: priceInUSD, // Updated price
                premium: premiumInUSD, // Updated premium
                maker: makerCalculated,
            };
        });

        console.log('Trades after processing:', trades);

        // Filter by maker if needed
        if (maker && maker !== 'ALL') {
            trades = trades.filter((trade) => trade.maker === maker);
        }

        // Paginate the results
        const totalRows = trades.length;
        const totalPages = Math.ceil(totalRows / parsedPageSize);
        const paginatedTrades = trades.slice(offset, offset + parsedPageSize);

        console.log(`Returning page ${parsedPage} of ${totalPages} with ${paginatedTrades.length} trades`);

        res.json({
            trades: paginatedTrades,
            totalPages,
        });
    } catch (error) {
        console.error('Error fetching trades:', error);
        res.status(500).send('Error fetching trades');
    }
});

module.exports = router;
