// routes/aiAnalysisRoutes.js
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

router.post('/analyze', async (req, res) => {
    try {
        const { trades } = req.body;
        console.log('Received trades:', trades);

        if (!trades || !Array.isArray(trades)) {
            return res.status(400).json({ error: 'Invalid trades data' });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user",
                content: `Analyze this options trade(s):
                   ${trades.map(trade => `
                       Type: ${trade.instrument_name}
                       Side: ${trade.side} 
                       Strike: ${trade.strike}
                       IV: ${trade.iv}%
                       Size: ${trade.size}
                       Premium: ${trade.premium}
                   `).join('\n')}`
            }],
            max_tokens: 500
        });

        res.json({ analysis: response.choices[0].message.content });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/analyze-metrics', async (req, res) => {
    try {
        const { metrics } = req.body;
        console.log('Received metrics:', metrics);

        if (!metrics) {
            return res.status(400).json({ error: 'Missing metrics data' });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user",
                content: `Analysis for: ${metrics.asset} on ${metrics.exchange}
                    Period: ${metrics.timeRange}
                    Price: $${metrics.avgPrice}
                    Volume: $${metrics.totalVolume}
                    Premium: $${metrics.totalPremium}`
            }],
            max_tokens: 500
        });

        console.log('OpenAI response:', response.data);
        res.json({ analysis: response.choices[0].message.content });
    } catch (error) {
        console.error('Server error details:', error);
        res.status(500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});
module.exports = router;