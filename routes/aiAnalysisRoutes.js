const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const pool = require('../config/database');

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

        // Валидация входных данных
        validateTrades(trades);

        // Определяем тип стратегии
        const strategyType = detectStrategy(trades);

        // Рассчитываем метрики
        const metrics = calculateMetrics(trades);

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

// Маппинг сокращений бирж
const EXCHANGE_MAPPING = {
    'DER': 'Deribit',
    'DERIBIT': 'Deribit',
    'BIT': 'Bybit',
    'BYBIT': 'Bybit',
    'BNB': 'Binance',
    'BINANCE': 'Binance',
    'OKX': 'OKX'
};

function getExchangeName(code) {
    return EXCHANGE_MAPPING[code.toUpperCase()] || code;
}
function formatLargeNumber(number) {
    if (typeof number !== 'number') {
        number = parseFloat(number.replace(/[^\d.-]/g, ''));
    }
    if (number >= 1e9) {
        return (number / 1e9).toFixed(2) + 'B';
    }
    if (number >= 1e6) {
        return (number / 1e6).toFixed(2) + 'M';
    }
    if (number >= 1e3) {
        return (number / 1e3).toFixed(2) + 'K';
    }
    return number.toFixed(2);
}

// Exchange tables configuration
const exchangeTables = {
    OKX: {
        btc: 'okx_btc_trades',
        eth: 'okx_eth_trades',
    },
    DER: {
        btc: 'all_btc_trades',
        eth: 'all_eth_trades',
    },
};

router.post('/analyze-metrics', async (req, res) => {
    try {
        const { metrics, timeRange = '24h', exchange } = req.body;
        const tableName = exchangeTables[exchange?.toUpperCase()]?.btc || 'all_btc_trades';
        let interval = '24 hours';

        if (timeRange === '7d') interval = '7 days';
        else if (timeRange === '30d') interval = '30 days';

        // Fetch all required metrics from database
        const directionMetrics = await pool.query(`
            SELECT 
                SUM(CASE WHEN instrument_name LIKE '%-C' AND direction = 'buy' THEN amount ELSE 0 END) AS "Call_Buys",
                SUM(CASE WHEN instrument_name LIKE '%-C' AND direction = 'sell' THEN amount ELSE 0 END) AS "Call_Sells",
                SUM(CASE WHEN instrument_name LIKE '%-P' AND direction = 'buy' THEN amount ELSE 0 END) AS "Put_Buys",
                SUM(CASE WHEN instrument_name LIKE '%-P' AND direction = 'sell' THEN amount ELSE 0 END) AS "Put_Sells"
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '${interval}';
        `);

        const popularOptions = await pool.query(`
            SELECT instrument_name, COUNT(*) AS trade_count
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '${interval}'
            GROUP BY instrument_name
            ORDER BY trade_count DESC
            LIMIT 10;
        `);

        const strikeActivity = await pool.query(`
            SELECT instrument_name, COUNT(*) AS trade_count
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '${interval}'
            GROUP BY instrument_name
            ORDER BY trade_count DESC;
        `);

        const timeDistribution = await pool.query(`
            SELECT
                DATE_TRUNC('hour', timestamp) as hour,
                CASE WHEN instrument_name LIKE '%-C' THEN 'call' ELSE 'put' END AS option_type,
                COUNT(*) as trade_count
            FROM ${tableName}
            WHERE timestamp >= NOW() - INTERVAL '${interval}'
            GROUP BY hour, option_type
            ORDER BY hour DESC;
        `);

        const expirationActivity = await pool.query(`
            SELECT 
                SUBSTRING(instrument_name FROM '([0-9]{1,2}[A-Z]{3}[0-9]{2})') AS expiration_date,
                CASE WHEN instrument_name LIKE '%-C' THEN 'call' ELSE 'put' END AS option_type,
                COUNT(*) AS trade_count
            FROM 
                ${tableName}
            WHERE 
                timestamp >= NOW() - INTERVAL '${interval}'
            GROUP BY 
                expiration_date, option_type
            ORDER BY 
                expiration_date;
        `);


        // Format the data for the prompt
        const dm = directionMetrics.rows[0];
        const total = parseFloat(dm.Call_Buys) + parseFloat(dm.Call_Sells) +
            parseFloat(dm.Put_Buys) + parseFloat(dm.Put_Sells);

        const prompt = `Analyze the following ${metrics.asset} options market activity on ${getExchangeName(exchange)} over the last ${interval}:

1. Direction Analysis:
   • Call Buys: ${((parseFloat(dm.Call_Buys) / total) * 100).toFixed(2)}%
   • Call Sells: ${((parseFloat(dm.Call_Sells) / total) * 100).toFixed(2)}%
   • Put Buys: ${((parseFloat(dm.Put_Buys) / total) * 100).toFixed(2)}%
   • Put Sells: ${((parseFloat(dm.Put_Sells) / total) * 100).toFixed(2)}%

2. Top Traded Options Analysis:
   ${popularOptions.rows.slice(0, 5).map(row =>
            `• ${row.instrument_name}: ${row.trade_count} trades`).join('\n   ')}

3. Strike Price Activity:
   ${formatStrikeActivityForPrompt(strikeActivity.rows)}

4. Trading Pattern Analysis:
   • Most active trading hours (UTC)
   • Call vs Put distribution throughout the day
   • Notable volume spikes or unusual patterns
   
5. Expiration Analysis:
   ${formatExpirationActivityForPrompt(expirationActivity.rows)}
   
6. Hourly Trading Distribution:
   ${formatHourlyDistribution(timeDistribution)}


Key Market Metrics:
• Average Option Price: $${metrics.avgPrice}
• Total Trading Volume: $${formatLargeNumber(metrics.totalVolume)}
• Total Premium Traded: $${formatLargeNumber(metrics.totalPremium)}
• Premium/Volume Ratio: ${(metrics.totalPremium / metrics.totalVolume * 100).toFixed(2)}%

Please provide a comprehensive market analysis covering:

1. Market Sentiment Assessment
   - What is the dominant trading direction (calls vs puts)?
   - Are traders positioning more defensively or aggressively?
   - How does the put/call ratio compare to recent trends?

2. Top Traded Options Analysis
   - What patterns emerge from the most actively traded options?
   - What do the expiration dates of top traded options suggest about market expectations?
   - Is there a notable bias in strike prices selection (OTM/ITM/ATM)?
   - Are there any significant imbalances between calls and puts in top trades?
   - What might the concentration of trades in specific strikes/dates indicate?

3. Strike Price Analysis
   - Which strike prices are seeing the most activity?
   - What does the distribution of strikes suggest about price expectations?
   - Are there any notable concentrations of activity at specific levels?

4. Trading Patterns and Timing
   - What are the peak trading hours and their significance?
   - Are there any correlations between time periods and option types?
   - How might these patterns inform trading strategies?
   
5. Expiration Date Analysis
   - What is the most active expiration date overall?
   - How is activity distributed between near-term and longer-dated options?
   - Is there a preference for specific expiration dates in calls vs puts?
   - What do the expiration preferences suggest about market outlook?
   - Are there any notable imbalances in call/put ratio for specific dates?

6. Market Implications
   - What potential market moves might this activity be anticipating?
   - Are there any significant risk factors indicated by these metrics?
   - How might this affect near-term market dynamics?

Focus on practical insights and actionable information for traders. Keep the analysis clear and data-driven.`;

        console.log('=== Final Prompt ===');
        console.log(prompt);
        console.log('=== Prompt Metrics ===');
        console.log('Prompt length:', prompt.length);
        console.log('Number of sections:', prompt.split('\n\n').length);
        console.log('================================');


        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{
                role: "system",
                content: "You are a crypto options market analyst specializing in derivatives exchanges. Provide clear, actionable insights about market activity and potential implications. Use data-driven analysis to support your conclusions."
            }, {
                role: "user",
                content: prompt
            }],
            max_tokens: 1500,
            temperature: 0.7
        });

        res.json({
            analysis: response.choices[0].message.content,
            metrics: {
                direction: directionMetrics.rows[0],
                popularOptions: popularOptions.rows.slice(0, 5),
                timeDistribution: timeDistribution.rows
            }
        });

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

function formatHourlyDistribution(timeDistribution) {
    const hourlyData = timeDistribution.rows.reduce((acc, row) => {
        const hour = new Date(row.hour).getUTCHours();
        if (!acc[hour]) {
            acc[hour] = { calls: 0, puts: 0 };
        }
        if (row.option_type === 'call') {
            acc[hour].calls += parseInt(row.trade_count);
        } else {
            acc[hour].puts += parseInt(row.trade_count);
        }
        return acc;
    }, {});

    return Object.entries(hourlyData)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([hour, data]) =>
            `• ${String(hour).padStart(2, '0')}:00 UTC: ${data.calls} calls, ${data.puts} puts`)
        .join('\n   ');
}
function formatExpirationActivityForPrompt(expirationData) {
    // Group by expiration date
    const grouped = expirationData.reduce((acc, row) => {
        if (!acc[row.expiration_date]) {
            acc[row.expiration_date] = {
                calls: 0,
                puts: 0
            };
        }
        if (row.option_type === 'call') {
            acc[row.expiration_date].calls += parseInt(row.trade_count);
        } else {
            acc[row.expiration_date].puts += parseInt(row.trade_count);
        }
        return acc;
    }, {});

    // Convert to array and sort by date
    const sortedDates = Object.entries(grouped)
        .map(([date, counts]) => ({
            date,
            total: counts.calls + counts.puts,
            ratio: counts.calls / (counts.puts || 1)
        }))
        .sort((a, b) => new Date(convertToISODate(a.date)) - new Date(convertToISODate(b.date)));

    // Format the output
    return sortedDates
        .slice(0, 5)
        .map(({ date, total, ratio }) =>
            `• ${date}: ${total} trades (C/P ratio: ${ratio.toFixed(2)})`
        )
        .join('\n   ');
}

// Helper function to convert date format
function convertToISODate(dateStr) {
    const months = {
        JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
        JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    };

    const day = dateStr.substring(0, 2);
    const month = months[dateStr.substring(2, 5)];
    const year = '20' + dateStr.substring(5, 7);

    return `${year}-${month}-${day}`;
}

// Helper function to format strike activity data
function formatStrikeActivityForPrompt(strikeData) {
    const aggregated = strikeData.reduce((acc, row) => {
        const match = row.instrument_name.match(/(\d+)-([CP])$/);
        if (!match) return acc;

        const [_, strike, type] = match;
        const key = `${strike}-${type}`;
        acc[key] = (acc[key] || 0) + parseInt(row.trade_count);
        return acc;
    }, {});

    return Object.entries(aggregated)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([strike, count]) =>
            `• Strike ${strike}: ${count} trades`)
        .join('\n   ');
}

// Helper function to get exchange name
function getExchangeName(exchange) {
    const exchangeMap = {
        'OKX': 'OKX',
        'DER': 'Deribit'
    };
    return exchangeMap[exchange?.toUpperCase()] || 'Unknown Exchange';
}

// Helper function to format large numbers
function formatLargeNumber(num) {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
}

module.exports = router;