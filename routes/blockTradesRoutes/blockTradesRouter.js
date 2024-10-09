const express = require('express');
const router = express.Router();
const { getBlockTrades } = require('../../controllers/blockTradesController');
const { getBTCMetrics, getETHMetrics } = require('../../controllers/blockTradesController');


// Маршрут для получения BTC блок-трейдов
router.get('/btc', getBTCMetrics);
router.get('/eth', getETHMetrics);

module.exports = router;
