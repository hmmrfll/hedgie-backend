const express = require('express');
const pool = require('../../config/database');
const moment = require('moment');
const router = express.Router();

const calculateDTE = (instrumentName) => {
    const expDate = instrumentName.split('-')[1];
    const expDateFormatted = moment(expDate, 'DDMMMYY');
    const now = moment();
    const dte = expDateFormatted.diff(now, 'days');
    return dte >= 0 ? `${dte}d` : '0d';
};

const determineMaker = (premium) => {
    if (premium < 250) return '🐙🦑';
    if (premium < 1000) return '🐟🎣';
    if (premium < 10000) return '🐡🚣';
    if (premium < 100000) return '🐬🌊';
    if (premium < 1000000) return '🐋🐳';
    if (premium < 10000000) return '🦈';
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
            query += ` AND direction = '${side.toLowerCase()}'`;
        }

        query += ` ORDER BY timestamp DESC`;

        const tradesResult = await pool.query(query);

        let trades = tradesResult.rows.map((trade) => {
            const strike = trade.instrument_name.match(/\d+(?=-[CP]$)/);
            const dte = calculateDTE(trade.instrument_name);

            const priceInUSD = (parseFloat(trade.price) * parseFloat(trade.spot)).toFixed(2); // price * index_price
            const premiumInUSD = (parseFloat(trade.price) * parseFloat(trade.size) * parseFloat(trade.spot)).toFixed(2); // price * size * index_price

            const makerCalculated = determineMaker(parseFloat(premiumInUSD));

            return {
                ...trade,
                strike: strike ? strike[0] : null,
                dte,
                price: priceInUSD,
                premium: premiumInUSD,
                maker: makerCalculated,
            };
        });

        console.log('Trades after processing:', trades);

        if (maker && maker !== 'ALL') {
            trades = trades.filter((trade) => trade.maker === maker);
        }

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
