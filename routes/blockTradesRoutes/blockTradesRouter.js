const express = require('express');
const router = express.Router();
const { getBlockTrades } = require('../../controllers/blockTradesController');

// Маршрут для получения BTC блок-трейдов
router.get('/btc', (req, res) => getBlockTrades('btc_block_trades', res));

// Маршрут для получения ETH блок-трейдов
router.get('/eth', (req, res) => getBlockTrades('eth_block_trades', res));

module.exports = router;
