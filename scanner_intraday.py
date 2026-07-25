import os
import json
import requests
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

# ==========================================
# CONFIGURATION & HYPERPARAMETERS
# ==========================================
MIN_TURNOVER_CR = 10.0      # Minimum turnover in ₹ Crores per day
MIN_CHANGE_PCT = 2.0        # Min Day Change %
MAX_CHANGE_PCT = 8.0        # Max Day Change % (avoids chasing overextended moves)
MIN_VOL_RATIO = 1.5         # Relative volume vs 20-day average
MAX_RSI_5MIN = 75.0         # RSI Overbought cap
MAX_WORKERS = 10            # Concurrent download threads

# List of liquid NSE tickers
TICKERS = [
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS", 
    "SBIN.NS", "BHARTIARTL.NS", "ITC.NS", "LTIM.NS", "LT.NS", 
    "AXISBANK.NS", "KOTAKBANK.NS", "TATAMOTORS.NS", "TATASTEEL.NS", "M&M.NS",
    "NTPC.NS", "POWERGRID.NS", "BAJFINANCE.NS", "MARUTI.NS", "SUNPHARMA.NS",
    "ULTRACEMCO.NS", "TITAN.NS", "ADANIENT.NS", "ADANIPORTS.NS", "JINDWORLD.NS",
    "MAHABANK.NS", "UJJIVANSFB.NS", "MOREPENLAB.NS", "IDFCFIRSTB.NS"
]

def calculate_rsi(series, period=14):
    """Calculates Wilder's RSI accurately."""
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / (loss + 1e-10)
    return 100 - (100 / (1 + rs))

def process_single_ticker(ticker):
    """Fetches daily + intraday data and screens for valid intraday setups."""
    try:
        stock = yf.Ticker(ticker)
        
        # 1. Daily Data for 200 EMA & Average Volume
        df_daily = stock.history(period="1y", interval="1d")
        if df_daily.empty or len(df_daily) < 200:
            return None
        
        close_daily = df_daily['Close']
        vol_daily = df_daily['Volume']
        ema_200 = close_daily.ewm(span=200, adjust=False).mean().iloc[-1]
        avg_vol_20d = vol_daily.iloc[-21:-1].mean()
        
        # 2. Intraday 5-Min Data
        df_5m = stock.history(period="5d", interval="5m")
        if df_5m.empty or len(df_5m) < 15:
            return None
        
        # Latest Price & Indicators
        current_price = float(df_5m['Close'].iloc[-1])
        open_price = float(df_5m['Open'].iloc[0])
        day_high = float(df_5m['High'].max())
        day_low = float(df_5m['Low'].min())
        cum_volume = float(df_5m['Volume'].sum())
        
        # Calculate Technical Indicators
        df_5m['RSI'] = calculate_rsi(df_5m['Close'], 14)
        rsi_latest = float(df_5m['RSI'].iloc[-1])
        
        # Calculate ATR (14) for Dynamic Stop-Loss
        high_low = df_5m['High'] - df_5m['Low']
        high_close = np.abs(df_5m['High'] - df_5m['Close'].shift())
        low_close = np.abs(df_5m['Low'] - df_5m['Close'].shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr_14 = float(tr.rolling(14).mean().iloc[-1])
        
        # Percentage Change & Relative Metrics
        day_change_pct = ((current_price - open_price) / open_price) * 100.0
        vol_ratio = cum_volume / (avg_vol_20d + 1e-5)
        turnover_cr = (current_price * cum_volume) / 1e7
        
        # ==========================================
        # HARD SCREENING CONDITIONS
        # ==========================================
        if not (MIN_CHANGE_PCT <= day_change_pct <= MAX_CHANGE_PCT):
            return None
        if vol_ratio < MIN_VOL_RATIO:
            return None
        if turnover_cr < MIN_TURNOVER_CR:
            return None
        if current_price < ema_200:
            return None
        if rsi_latest > MAX_RSI_5MIN:
            return None
            
        # Target & Stop-Loss Calculation
        stop_loss_dist = min(atr_14 * 1.5, current_price * 0.03)
        stop_loss = round(current_price - stop_loss_dist, 2)
        target_1 = round(current_price + (stop_loss_dist * 1.5), 2)
        target_2 = round(current_price + (stop_loss_dist * 2.5), 2)
        
        symbol_clean = ticker.replace(".NS", "")
        return {
            "symbol": symbol_clean,
            "price": round(current_price, 2),
            "change_pct": round(day_change_pct, 2),
            "vol_ratio": round(vol_ratio, 2),
            "turnover_cr": round(turnover_cr, 2),
            "rsi_5m": round(rsi_latest, 1),
            "ema_200": round(ema_200, 2),
            "stop_loss": stop_loss,
            "target_1": target_1,
            "target_2": target_2,
            "day_high": round(day_high, 2),
            "day_low": round(day_low, 2)
        }
    except Exception:
        return None

def send_telegram_alert(signal, bot_token, chat_id):
    """Sends real-time formatted buy alerts to Telegram."""
    if not bot_token or not chat_id:
        return
    
    msg = (
        f"🚨 <b>INTRADAY MOMENTUM SIGNAL</b> 🚨\n\n"
        f"<b>Symbol:</b> #{signal['symbol']}\n"
        f"<b>Entry Price:</b> ₹{signal['price']}\n"
        f"<b>Day Change:</b> +{signal['change_pct']}%\n"
        f"<b>Vol Ratio:</b> {signal['vol_ratio']}x\n"
        f"<b>RSI (5m):</b> {signal['rsi_5m']}\n\n"
        f"🎯 <b>Target 1 (1:1.5):</b> ₹{signal['target_1']}\n"
        f"🎯 <b>Target 2 (1:2.5):</b> ₹{signal['target_2']}\n"
        f"🛑 <b>Stop Loss:</b> ₹{signal['stop_loss']}\n"
    )
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": msg, "parse_mode": "HTML"}
    try:
        requests.post(url, json=payload, timeout=5)
    except Exception as e:
        print(f"Telegram Alert failed for {signal['symbol']}: {e}")

def run_scanner():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Starting High-Speed Scanner Process...")
    signals = []
    
    # Concurrent Multithreaded Execution
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_ticker = {executor.submit(process_single_ticker, ticker): ticker for ticker in TICKERS}
        for future in as_completed(future_to_ticker):
            res = future.result()
            if res:
                signals.append(res)
    
    # Sort signals by highest volume surge
    signals = sorted(signals, key=lambda x: x['vol_ratio'], reverse=True)
    
    # Save output to signals.json
    output_data = {
        "last_updated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "total_signals": len(signals),
        "signals": signals
    }
    
    with open("signals.json", "w") as f:
        json.dump(output_data, f, indent=2)
    
    print(f"Scanner Execution Complete. Found {len(signals)} signals.")
    
    # Dispatch Telegram Alerts
    bot_token = os.getenv("BOT_TOKEN")
    chat_id = os.getenv("CHAT_ID")
    if bot_token and chat_id:
        for sig in signals:
            send_telegram_alert(sig, bot_token, chat_id)

if __name__ == "__main__":
    run_scanner()
