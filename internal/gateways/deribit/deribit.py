import requests
import psycopg2
from datetime import datetime, timedelta
import time
import pytz
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

# Константы и настройки
BASE_URL = 'https://www.deribit.com/api/v2'
CURRENCY_PAIRS = ['BTC', 'ETH']
MOSCOW_TZ = pytz.timezone('Europe/Moscow')

# Настройки PostgreSQL
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "deribit_trades"
DB_USER = "admin"
DB_PASSWORD = "admin123"

# Подключение к PostgreSQL
def get_postgres_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

# Настройка повторных попыток запроса
retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
adapter = HTTPAdapter(max_retries=retries)
http = requests.Session()
http.mount("https://", adapter)

def get_last_trades_by_currency(currency, start_timestamp, end_timestamp):
    endpoint = f"{BASE_URL}/public/get_last_trades_by_currency_and_time"
    params = {
        'currency': currency,
        'start_timestamp': start_timestamp,
        'end_timestamp': end_timestamp,
        'count': 1000,
        'include_old': False
    }
    try:
        response = http.get(endpoint, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return {}

def filter_options(trades):
    # Фильтрация опционов (например: BTC-13SEP24-65000-C или BTC-13SEP24-65000-P)
    return [
        trade for trade in trades 
        if "-" in trade['instrument_name'] and trade['instrument_name'].split('-')[-1] in {'C', 'P'}
    ]

def filter_block_trades(trades):
    # Фильтрация блок-трейдов из списка опционов
    return [trade for trade in trades if 'block_trade_id' in trade and 'block_trade_leg_count' in trade]

def save_trades_to_postgres(trades, currency, table_name):
    conn = get_postgres_connection()
    cursor = conn.cursor()

    for trade in trades:
        cursor.execute(f"""
        SELECT 1 FROM {table_name} WHERE trade_id = %s LIMIT 1
        """, (trade['trade_id'],))
        exists = cursor.fetchone()

        if exists:
            print(f"Skipping existing trade with trade_id {trade['trade_id']}")
            continue

        query = f"""
        INSERT INTO {table_name} (
            trade_id, block_trade_leg_count, contracts, block_trade_id, combo_id, tick_direction, 
            mark_price, amount, trade_seq, instrument_name, index_price, direction, price, iv, 
            liquidation, combo_trade_id, timestamp
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, to_timestamp(%s / 1000))
        ON CONFLICT DO NOTHING;
        """
        cursor.execute(query, (
            trade['trade_id'],
            trade.get('block_trade_leg_count', None),
            trade.get('contracts', None),
            trade.get('block_trade_id', None),
            trade.get('combo_id', None),
            trade.get('tick_direction', None),
            trade.get('mark_price', None),
            trade.get('amount', None),
            trade.get('trade_seq', None),
            trade.get('instrument_name', None),
            trade.get('index_price', None),
            trade.get('direction', None),
            trade.get('price', None),
            trade.get('iv', None),
            trade.get('liquidation', None),
            trade.get('combo_trade_id', None),
            trade['timestamp']
        ))

    conn.commit()
    cursor.close()
    conn.close()
    print(f"Saved {len(trades)} trades to {table_name} for {currency}")

def fetch_and_save_trades():
    current_time_utc = datetime.now(pytz.utc)
    one_minute_ago = current_time_utc - timedelta(minutes=1)
    
    start_timestamp = int(one_minute_ago.timestamp() * 1000)
    end_timestamp = int(current_time_utc.timestamp() * 1000)

    for currency in CURRENCY_PAIRS:
        trades_response = get_last_trades_by_currency(currency, start_timestamp, end_timestamp)
        if 'result' in trades_response and 'trades' in trades_response['result']:
            trades = trades_response['result']['trades']
            if trades:
                # Фильтрация только опционов
                options_trades = filter_options(trades)
                # Сохранение всех опционов
                save_trades_to_postgres(options_trades, currency, f"all_{currency.lower()}_trades")

                # Фильтрация и сохранение блоковых сделок для опционов
                block_trades = filter_block_trades(options_trades)
                if block_trades:
                    save_trades_to_postgres(block_trades, currency, f"{currency.lower()}_block_trades")
        else:
            print(f"No option trades found for {currency} in the last minute")

if __name__ == "__main__":
    while True:
        fetch_and_save_trades()
        time.sleep(60)
