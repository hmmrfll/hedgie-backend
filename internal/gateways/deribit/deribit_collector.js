const axios = require('axios');
const pool = require('../../../config/database');

class DeribitCollector {
    constructor() {
        this.BASE_URL = 'https://www.deribit.com/api/v2';
        this.CURRENCY_PAIRS = ['BTC', 'ETH'];
        this.isRunning = false;
        this.intervalId = null;

        this.http = axios.create({
            timeout: 30000,
            retry: 3,
            retryDelay: 1000
        });
    }

    async getLastTradesByCurrency(currency, startTimestamp, endTimestamp) {
        const endpoint = `${this.BASE_URL}/public/get_last_trades_by_currency_and_time`;
        const params = {
            currency,
            start_timestamp: startTimestamp,
            end_timestamp: endTimestamp,
            count: 1000,
            include_old: false
        };

        try {
            const response = await this.http.get(endpoint, { params });
            return response.data;
        } catch (error) {
            console.error(`Request failed: ${error.message}`);
            return {};
        }
    }

    filterOptions(trades) {
        return trades.filter(trade =>
            trade.instrument_name.includes('-') &&
            ['C', 'P'].includes(trade.instrument_name.split('-').pop())
        );
    }

    filterBlockTrades(trades) {
        return trades.filter(trade =>
            trade.block_trade_id && trade.block_trade_leg_count
        );
    }

    async saveTradesToPostgres(trades, currency, tableName) {
        const client = await pool.connect();

        try {
            for (const trade of trades) {
                const existsQuery = `SELECT 1 FROM ${tableName} WHERE trade_id = $1 LIMIT 1`;
                const existsResult = await client.query(existsQuery, [trade.trade_id]);

                if (existsResult.rows.length > 0) {
                    console.log(`Skipping existing trade with trade_id ${trade.trade_id}`);
                    continue;
                }

                const insertQuery = `
                    INSERT INTO ${tableName} (
                        trade_id, block_trade_leg_count, contracts, block_trade_id, combo_id,
                        tick_direction, mark_price, amount, trade_seq, instrument_name,
                        index_price, direction, price, iv, liquidation, combo_trade_id, timestamp
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, to_timestamp($17 / 1000))
                    ON CONFLICT DO NOTHING
                `;

                await client.query(insertQuery, [
                    trade.trade_id,
                    trade.block_trade_leg_count || null,
                    trade.contracts || null,
                    trade.block_trade_id || null,
                    trade.combo_id || null,
                    trade.tick_direction || null,
                    trade.mark_price || null,
                    trade.amount || null,
                    trade.trade_seq || null,
                    trade.instrument_name || null,
                    trade.index_price || null,
                    trade.direction || null,
                    trade.price || null,
                    trade.iv || null,
                    trade.liquidation || null,
                    trade.combo_trade_id || null,
                    trade.timestamp
                ]);
            }

            console.log(`Saved ${trades.length} trades to ${tableName} for ${currency}`);
        } catch (error) {
            console.error(`Error saving trades: ${error.message}`);
        } finally {
            client.release();
        }
    }

    async fetchAndSaveTrades() {
        const currentTimeUTC = new Date();
        const oneMinuteAgo = new Date(currentTimeUTC.getTime() - 60 * 1000);

        const startTimestamp = Math.floor(oneMinuteAgo.getTime());
        const endTimestamp = Math.floor(currentTimeUTC.getTime());

        for (const currency of this.CURRENCY_PAIRS) {
            try {
                const tradesResponse = await this.getLastTradesByCurrency(
                    currency,
                    startTimestamp,
                    endTimestamp
                );

                if (tradesResponse.result && tradesResponse.result.trades) {
                    const trades = tradesResponse.result.trades;

                    if (trades.length > 0) {
                        const optionsTrades = this.filterOptions(trades);

                        await this.saveTradesToPostgres(
                            optionsTrades,
                            currency,
                            `all_${currency.toLowerCase()}_trades`
                        );

                        const blockTrades = this.filterBlockTrades(optionsTrades);
                        if (blockTrades.length > 0) {
                            await this.saveTradesToPostgres(
                                blockTrades,
                                currency,
                                `${currency.toLowerCase()}_block_trades`
                            );
                        }
                    }
                } else {
                    console.log(`No option trades found for ${currency} in the last minute`);
                }
            } catch (error) {
                console.error(`Error processing ${currency}: ${error.message}`);
            }
        }
    }

    start() {
        if (this.isRunning) {
            console.log('Trade collector is already running');
            return;
        }

        console.log('Starting trade collector...');
        this.isRunning = true;

        this.fetchAndSaveTrades();

        this.intervalId = setInterval(() => {
            this.fetchAndSaveTrades();
        }, 60000);
    }

    stop() {
        if (!this.isRunning) {
            console.log('Trade collector is not running');
            return;
        }

        console.log('Stopping trade collector...');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            currencies: this.CURRENCY_PAIRS,
            intervalId: this.intervalId
        };
    }
}

module.exports = new DeribitCollector();
