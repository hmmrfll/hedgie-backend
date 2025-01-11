const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Функция валидации данных
function validateTrades(trades) {
    if (!trades || !Array.isArray(trades) || trades.length === 0) {
        throw new Error('Invalid trades data');
    }

    // Проверяем наличие необходимых полей в каждой сделке
    trades.forEach((trade, index) => {
        const requiredFields = [
            'expiration_date', 'strike', 'side', 'k', 'size',
            'iv', 'premium', 'spot', 'instrument_name', 'price'
        ];

        requiredFields.forEach(field => {
            if (!(field in trade)) {
                throw new Error(`Missing ${field} in trade ${index + 1}`);
            }
        });
    });

    return true;
}
// Функция определения типа стратегии
function detectStrategy(trades) {
    if (!trades || trades.length !== 2) return 'Complex Strategy';

    const [trade1, trade2] = trades;

    try {
        const sameStrike = trade1.strike === trade2.strike;
        const sameExpiry = trade1.expiration_date === trade2.expiration_date;
        const oppositeDirections = (trade1.side === 'buy' && trade2.side === 'sell') ||
            (trade1.side === 'sell' && trade2.side === 'buy');
        const samePutCall = trade1.k === trade2.k;
        const sameSize = trade1.size === trade2.size;

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
    } catch (error) {
        console.error('Error in detectStrategy:', error);
        return 'Unknown Strategy';
    }
}
// Безопасное вычисление метрик
function calculateMetrics(trades) {
    try {
        const expiryDiff = Math.round(
            (new Date(trades[0].expiration_date) - new Date(trades[1].expiration_date)) /
            (1000 * 60 * 60 * 24)
        );

        const netPremium = trades.reduce((sum, trade) =>
            sum + (trade.side === 'sell' ? trade.premium : -trade.premium), 0
        );

        const strikeVsSpot = ((trades[0].strike - trades[0].spot) / trades[0].spot * 100).toFixed(2);
        const volDiff = Math.abs(trades[0].iv - trades[1].iv).toFixed(2);

        return {
            expiryDiff,
            netPremium,
            strikeVsSpot,
            volDiff
        };
    } catch (error) {
        console.error('Error calculating metrics:', error);
        return {
            expiryDiff: 'N/A',
            netPremium: 'N/A',
            strikeVsSpot: 'N/A',
            volDiff: 'N/A'
        };
    }
}

router.post('/analyze', async (req, res) => {
    try {
        const { trades } = req.body;
        console.log('Received trades:', trades);

        // Валидация входных данных
        validateTrades(trades);

        // Определяем тип стратегии
        const strategyType = detectStrategy(trades);
        console.log('Strategy Type:', strategyType);

        // Рассчитываем метрики
        const metrics = calculateMetrics(trades);
        console.log('Calculated Metrics:', metrics);

        const prompt = `You are analyzing a BTC options block trade (${trades[0].block_trade_id || 'Unknown ID'}):

Market Context:
• BTC Current Price: $${trades[0].spot}
• Trade Time: ${trades[0].timeutc || 'Unknown'}
• Exchange: ${trades[0].exchange || 'Unknown'}
• Type: Block Trade by ${trades[0].maker || 'Unknown'}

Strategy Type: ${strategyType}

Trade Details:
${trades.map(trade => `
${trade.side.toUpperCase()} ${trade.size} contracts of ${trade.instrument_name}
• Option Type: ${trade.k === 'P' ? 'Put' : 'Call'}
• Expires: ${new Date(trade.expiration_date).toLocaleDateString()} (${trade.dte || 'Unknown'})
• Strike: $${trade.strike}
• IV: ${trade.iv}%
• Premium: $${trade.premium}
• Price per contract: $${trade.price}`).join('\n')}

Position Metrics:
• Net Premium: ${metrics.netPremium !== 'N/A' ?
            (metrics.netPremium > 0 ? '+$' : '-$') + Math.abs(metrics.netPremium).toFixed(2) : 'N/A'}
• Strike vs Spot: ${metrics.strikeVsSpot}%
${strategyType === 'Calendar Spread' ? `• Expiry Difference: ${metrics.expiryDiff} days` : ''}
• Volatility Differential: ${metrics.volDiff}%

Please analyze this ${strategyType} from an institutional perspective:

1. Strategy Analysis
   - Strategic rationale and objectives
   - Parameter selection logic
   - Expected market behavior thesis

2. Volatility Analysis
   - IV differential analysis
   - Term structure/skew implications
   - Volatility exposure

3. Risk Profile
   - P&L scenarios
   - Key levels and breakevens
   - Risk factors and hedging

4. Market Context
   - Institutional positioning implications
   - Relevant catalysts and events
   - Market dynamics to monitor

5. Trade Management
   - Position management guidelines
   - Adjustment scenarios
   - Exit strategies

Provide sophisticated analysis focusing on institutional perspective and practical trading implications.`;

        console.log('=== Sending prompt to OpenAI (GPT-4) ===');
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
            metrics,
            model: "gpt-4"
        });
    } catch (error) {
        console.error('Server error details:', error);
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