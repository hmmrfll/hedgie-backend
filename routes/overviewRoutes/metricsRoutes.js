const express = require('express');
const { getBTCMetrics, getETHMetrics } = require('../../controllers/metricsController');
const router = express.Router();

router.get('/btc', getBTCMetrics);
router.get('/eth', getETHMetrics);

module.exports = router;
