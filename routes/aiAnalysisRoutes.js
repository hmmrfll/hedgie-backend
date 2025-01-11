const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Функция определения типа стратегии
function detectStrategy(trades) {
    if (trades.length !== 2) return 'Complex Strategy';

    const [trade1, trade2] = trades;

    // Проверяем основные параметры
    const sameStrike = trade1.strike === trade2.strike;
    const sameExpiry = trade1.expiration_date === trade2.expiration_date;
    const oppositeDirections = (trade1.side === 'buy' && trade2.side === 'sell') ||
        (trade1.side === 'sell' && trade2.side === 'buy');
    const samePutCall = trade1.k === trade2.k;
    const sameSize = trade1.size === trade2.size;

    // Определяем тип стратегии
    if (oppositeDirections && sameSize) {
        if (sameStrike && !sameExpiry && samePutCall) {
            return 'Calendar Spread';
        }
        if (!sameStrike && sameExpiry && samePutCall) {
            return 'Vertical Spread';
        }
        if (sameExpiry && !samePutCall) {
            if (sameStrike) return 'Conversion/Reversal';
            return 'Diagonal Spread';
        }
    }

    return 'Custom Strategy';
}

router.post('/analyze', async (req, res) => {
    try {
        const { trades } = req.body;
        console.log('Received trades:', trades);

        if (!trades || !Array.isArray(trades)) {
            return res.status(400).json({ error: 'Invalid trades data' });
        }

        // Определяем тип стратегии
        const strategyType = detectStrategy(trades);

        // Рассчитываем метрики
        const expiryDiff = Math.round((new Date(trades[0].expiration_date) - new Date(trades[1].expiration_date)) / (1000 * 60 * 60 * 24));
        const netPremium = trades.reduce((sum, trade) =>
            sum + (trade.side === 'sell' ? trade.premium : -trade.premium), 0
        );

        const prompt = `You are analyzing a BTC options block trade (${trades[0].block_trade_id}):

Market Context:
• BTC Current Price: $${trades[0].spot}
• Trade Time: ${trades[0].timeutc} UTC
• Exchange: ${trades[0].exchange}
• Type: Block Trade by ${trades[0].maker}

Strategy Type: ${strategyType}

Trade Details:
${trades.map(trade => `
${trade.side.toUpperCase()} ${trade.size} contracts of ${trade.instrument_name}
• Option Type: ${trade.k === 'P' ? 'Put' : 'Call'}
• Expires: ${new Date(trade.expiration_date).toLocaleDateString()} (${trade.dte})
• Strike: $${trade.strike}
• IV: ${trade.iv}%
• Premium: $${trade.premium}
• Price per contract: $${trade.price}`).join('\n')}

Position Metrics:
• Net Premium: ${netPremium > 0 ? '+$' : '-$'}${Math.abs(netPremium).toFixed(2)}
• Strike vs Spot: ${((trades[0].strike - trades[0].spot) / trades[0].spot * 100).toFixed(2)}%
${strategyType === 'Calendar Spread' ? `• Expiry Difference: ${expiryDiff} days` : ''}
• Volatility Differential: ${Math.abs(trades[0].iv - trades[1].iv).toFixed(2)}%

Please analyze this ${strategyType} from an institutional perspective:

1. Strategy Analysis
   - Strategic rationale behind this ${strategyType.toLowerCase()}
   - Why these specific parameters were chosen
   - Expected market behavior thesis

2. Volatility Analysis
   - Analysis of the ${Math.abs(trades[0].iv - trades[1].iv).toFixed(2)}% IV differential
   ${strategyType === 'Calendar Spread' ? '- Term structure implications' : '- Skew implications'}
   - Impact on position profitability

3. Risk Profile
   - Detailed P&L scenarios
   - Key price levels and breakeven analysis
   - Primary risk factors and hedging considerations

4. Market Context
   - What this institutional positioning suggests
   - Relevant market catalysts or events
   - Related market dynamics to monitor

5. Trade Management
   - Position management considerations
   - Adjustment triggers and scenarios
   - Exit strategies based on market movement

Provide sophisticated analysis focusing on institutional perspective and practical trading implications.`;

        console.log('=== Sending prompt to OpenAI (GPT-4) ===');
        console.log('Strategy Type Detected:', strategyType);
        console.log(prompt);
        console.log('======================================');

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{
                role: "system",
                content: "You are an elite institutional crypto derivatives trader specializing in complex options strategies and volatility trading. Provide sophisticated analysis with emphasis on practical trading implications and risk management."
            }, {
                role: "user",
                content: prompt
            }],
            max_tokens: 2000,
            temperature: 0.7
        });

        console.log('=== GPT-4 Response ===');
        console.log('Response content:', response.choices[0].message.content);
        console.log('Usage:', response.usage);
        console.log('====================');

        res.json({
            analysis: response.choices[0].message.content,
            strategyType,
            model: "gpt-4"
        });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({
            error: error.message,
            model: "gpt-4"
        });
    }
});
router.post('/analyze-metrics', async (req, res) => {
    try {
        const { metrics } = req.body;
        console.log('Received metrics:', metrics);

        if (!metrics) {
            return res.status(400).json({ error: 'Missing metrics data' });
        }

        const prompt = `Analysis for: ${metrics.asset} on ${metrics.exchange}
                    Period: ${metrics.timeRange}
                    Price: $${metrics.avgPrice}
                    Volume: $${metrics.totalVolume}
                    Premium: $${metrics.totalPremium}`;

        console.log('=== Sending metrics prompt to OpenAI ===');
        console.log(prompt);
        console.log('=======================================');

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user",
                content: prompt
            }],
            max_tokens: 500
        });

        console.log('=== OpenAI Metrics Response ===');
        console.log('Response content:', response.choices[0].message.content);
        console.log('Usage:', response.usage);
        console.log('============================');

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