psql -h localhost -p 5432 -U admin deribit_trades - for local
psql -U admin -d deribit_trades -h localhost -p 5432 - for server

CREATE USER admin WITH PASSWORD 'admin123' SUPERUSER;
CREATE DATABASE deribit_trades;
GRANT ALL PRIVILEGES ON DATABASE deribit_trades TO admin;

CREATE TABLE all_btc_trades (
    trade_id TEXT PRIMARY KEY,
    block_trade_leg_count INTEGER,
    contracts INTEGER,
    block_trade_id TEXT,
    combo_id TEXT,
    tick_direction TEXT,
    mark_price DECIMAL,
    amount DECIMAL,
    trade_seq BIGINT,
    instrument_name TEXT,
    index_price DECIMAL,
    direction TEXT,
    price DECIMAL,
    iv DECIMAL,
    liquidation BOOLEAN,
    combo_trade_id TEXT,
    timestamp TIMESTAMP
);

CREATE TABLE btc_block_trades (
    trade_id TEXT PRIMARY KEY,
    block_trade_leg_count INTEGER,
    contracts INTEGER,
    block_trade_id TEXT,
    combo_id TEXT,
    tick_direction TEXT,
    mark_price DECIMAL,
    amount DECIMAL,
    trade_seq BIGINT,
    instrument_name TEXT,
    index_price DECIMAL,
    direction TEXT,
    price DECIMAL,
    iv DECIMAL,
    liquidation BOOLEAN,
    combo_trade_id TEXT,
    timestamp TIMESTAMP
);

CREATE TABLE all_eth_trades (
    trade_id TEXT PRIMARY KEY,
    block_trade_leg_count INTEGER,
    contracts INTEGER,
    block_trade_id TEXT,
    combo_id TEXT,
    tick_direction TEXT,
    mark_price DECIMAL,
    amount DECIMAL,
    trade_seq BIGINT,
    instrument_name TEXT,
    index_price DECIMAL,
    direction TEXT,
    price DECIMAL,
    iv DECIMAL,
    liquidation BOOLEAN,
    combo_trade_id TEXT,
    timestamp TIMESTAMP
);

CREATE TABLE eth_block_trades (
    trade_id TEXT PRIMARY KEY,
    block_trade_leg_count INTEGER,
    contracts INTEGER,
    block_trade_id TEXT,
    combo_id TEXT,
    tick_direction TEXT,
    mark_price DECIMAL,
    amount DECIMAL,
    trade_seq BIGINT,
    instrument_name TEXT,
    index_price DECIMAL,
    direction TEXT,
    price DECIMAL,
    iv DECIMAL,
    liquidation BOOLEAN,
    combo_trade_id TEXT,
    timestamp TIMESTAMP
);