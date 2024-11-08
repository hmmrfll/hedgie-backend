const express = require('express');
const router = express.Router();
const { getBlockTrades } = require('../../controllers/blockTradesController');
const { getBTCMetrics, getETHMetrics } = require('../../controllers/blockTradesController');


router.get('/btc', getBTCMetrics);
router.get('/eth', getETHMetrics);

module.exports = router;
