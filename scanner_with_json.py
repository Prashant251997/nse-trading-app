import yfinance as yf
import requests
from datetime import datetime
import pytz
import os
import json
import numpy as np

# ── Configuration ──────────────────────────────────────────────────────────────
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
CHAT_ID   = os.environ.get("CHAT_ID",   "")

# Position Sizing Settings
TOTAL_CAPITAL = float(os.environ.get("TOTAL_CAPITAL", "50000"))
RISK_PERCENT = float(os.environ.get("RISK_PERCENT", "1.0"))
MAX_INVESTMENT_PER_TRADE = float(os.environ.get("MAX_INVESTMENT", "20000"))

# Enhanced Filters (v2)
MIN_SL_PERCENT = 1.0
ATR_MULTIPLIER = 1.5
MIN_RSI = 40
MAX_RSI = 65

# ── Stock Universe ─────────────────────────────────────────────────────────────
BANKS = ["YESBANK.NS", "IDFCFIRSTB.NS", "IDBI.NS", "PNB.NS", "UNIONBANK.NS",
         "IOB.NS", "CENTRALBK.NS", "UCOBANK.NS", "MAHABANK.NS", "BANKINDIA.NS",
         "INDIANB.NS", "PSB.NS", "UJJIVANSFB.NS", "SOUTHBANK.NS", "DCBBANK.NS"]
ENERGY = ["SUZLON.NS", "NHPC.NS", "SJVN.NS", "BHEL.NS", "RPOWER.NS",
          "JPPOWER.NS", "IRFC.NS", "RTNINDIA.NS", "GVKPIL.NS", "ADANIPOWER.NS"]
TELECOM = ["IDEA.NS", "HFCL.NS", "ITI.NS", "TVTODAY.NS", "DBCORP.NS"]
INFRA = ["NBCC.NS", "IRCON.NS", "RVNL.NS", "GMRINFRA.NS", "JPASSOCIAT.NS",
         "HUDCO.NS", "HCC.NS", "CGPOWER.NS", "PNCINFRA.NS", "RAYMOND.NS"]
PHARMA = ["MOREPENLAB.NS", "LLOYDSME.NS", "AUROPHARMA.NS", "GLENMARK.NS",
          "INDOCO.NS", "FDC.NS", "BLISSGVS.NS", "JBCHEPHARM.NS"]
METALS = ["SAIL.NS", "JINDALSTEL.NS", "WELCORP.NS", "JSL.NS", "RATNAMANI.NS",
          "JSWENERGY.NS", "GMDCLTD.NS", "MANGCHEFER.NS"]
AUTO = ["ASHOKLEY.NS", "TATAMOTORS.NS", "JKTYRE.NS", "CEATLTD.NS", "APOLLOTYRE.NS",
        "FIEMIND.NS", "MOTHERSON.NS"]
REALESTATE = ["DLF.NS", "OMAXAUTO.NS", "ANANTRAJ.NS", "SUNTECK.NS", "MAHINDCIE.NS"]
IT_DIGITAL = ["ROUTE.NS", "INTELLECT.NS", "MASTEK.NS", "PAYTM.NS", "ZOMATO.NS"]
TEXTILE = ["TRIDENT.NS", "VARDHACRLC.NS", "ALOKINDS.NS", "WELSPUNLIV.NS", "BIRLATYRE.NS"]
CONSUMER_MISC = ["MMTC.NS", "MOIL.NS", "PAGEIND.NS", "PRAKASH.NS", "JINDWORLD.NS",
                 "CGCL.NS", "ORIENTHOT.NS"]

ALL_STOCKS = list(set(BANKS + ENERGY + TELECOM + INFRA + PHARMA + METALS + 
                      AUTO + REALESTATE + IT_DIGITAL + TEXTILE + CONSUMER_MISC))


# ── Helper Functions ───────────────────────────────────────────────────────────
def calculate_rsi(series, period=14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def calculate_atr(df, period=14):
    df = df.copy()
    df["tr"] = np.maximum(
        df["High"] - df["Low"],
        np.maximum(
            abs(df["High"] - df["Close"].shift()),
            abs(df["Low"] - df["Close"].shift())
        )
    )
    return df["tr"].rolling(window=period).mean()


def calculate_fibonacci_levels(swing_high, swing_low):
    diff = swing_high - swing_low
    return {
        "38.2": swing_high - (diff * 0.382),
        "50.0": swing_high - (diff * 0.5),
        "61.8": swing_high - (diff * 0.618)
    }


def get_daily_data(symbol):
    try:
        df = yf.Ticker(symbol).history(period="1y", interval="1d")
        df.dropna(subset=["Close"], inplace=True)
        if len(df) < 200:
            return None
        if df["Close"].iloc[-1] > 100:
            return None
        df["ema200"] = df["Close"].ewm(span=200, adjust=False).mean()
        return df
    except:
        return None


def get_hourly_data(symbol):
    try:
        df = yf.Ticker(symbol).history(period="60d", interval="1h")
        df.dropna(subset=["Close"], inplace=True)
        if len(df) < 50:
            return None
        df["ema50"] = df["Close"].ewm(span=50, adjust=False).mean()
        return df
    except:
        return None


def get_intraday_data(symbol):
    try:
        df = yf.Ticker(symbol).history(period="5d", interval="15m")
        df.dropna(subset=["Close", "Volume"], inplace=True)
        if len(df) < 50:
            return None
        df["ema9"]   = df["Close"].ewm(span=9,  adjust=False).mean()
        df["ema21"]  = df["Close"].ewm(span=21, adjust=False).mean()
        df["rsi"]    = calculate_rsi(df["Close"], 14)
        df["atr"]    = calculate_atr(df, 14)
        return df
    except:
        return None


# ── Analysis Functions ─────────────────────────────────────────────────────────
def check_ema_reclaim(intraday_df):
    close = float(intraday_df["Close"].iloc[-1])
    ema9 = float(intraday_df["ema9"].iloc[-1])
    ema21 = float(intraday_df["ema21"].iloc[-1])
    if close <= ema9 or close <= ema21:
        return None
    if ema9 <= ema21:
        return None
    return {"above_9ema": round(((close - ema9) / ema9) * 100, 2),
            "above_21ema": round(((close - ema21) / ema21) * 100, 2)}


def check_bullish_candle(intraday_df):
    open_price = float(intraday_df["Open"].iloc[-1])
    close = float(intraday_df["Close"].iloc[-1])
    high = float(intraday_df["High"].iloc[-1])
    low = float(intraday_df["Low"].iloc[-1])
    if close <= open_price:
        return None
    candle_range = high - low
    if candle_range == 0:
        return None
    close_position = (close - low) / candle_range
    if close_position < 0.60:
        return None
    body = abs(close - open_price)
    if body / candle_range < 0.30:
        return None
    return {"close_position": round(close_position * 100, 1)}


def check_rsi_recovery(intraday_df):
    if len(intraday_df) < 5:
        return None
    curr_rsi = float(intraday_df["rsi"].iloc[-1])
    prev_rsi = float(intraday_df["rsi"].iloc[-2])
    rsi_3ago = float(intraday_df["rsi"].iloc[-4])
    if curr_rsi < MIN_RSI or curr_rsi > MAX_RSI:
        return None
    if curr_rsi <= prev_rsi or curr_rsi <= rsi_3ago:
        return None
    return {"curr_rsi": round(curr_rsi, 1), "rsi_change": round(curr_rsi - rsi_3ago, 1)}


def layer1_volume_momentum(intraday_df):
    avg_vol = intraday_df["Volume"].iloc[-21:-1].mean()
    today_vol = intraday_df["Volume"].iloc[-1]
    vol_ratio = today_vol / avg_vol if avg_vol > 0 else 0
    if vol_ratio < 1.8 or vol_ratio > 3.0:
        return None
    rsi_check = check_rsi_recovery(intraday_df)
    if rsi_check is None:
        return None
    candle_check = check_bullish_candle(intraday_df)
    if candle_check is None:
        return None
    return {
        "vol_ratio": round(vol_ratio, 2),
        "rsi": rsi_check["curr_rsi"],
        "rsi_change": rsi_check["rsi_change"],
        "close_strength": candle_check["close_position"]
    }


def layer2_multi_timeframe(daily_df, hourly_df, intraday_df):
    daily_price = float(daily_df["Close"].iloc[-1])
    daily_ema200 = float(daily_df["ema200"].iloc[-1])
    if daily_price <= daily_ema200:
        return None
    hourly_price = float(hourly_df["Close"].iloc[-1])
    hourly_ema50 = float(hourly_df["ema50"].iloc[-1])
    if hourly_price <= hourly_ema50:
        return None
    ema_check = check_ema_reclaim(intraday_df)
    if ema_check is None:
        return None
    return {
        "daily_above_ema": round(((daily_price - daily_ema200) / daily_ema200) * 100, 2),
        "hourly_above_ema": round(((hourly_price - hourly_ema50) / hourly_ema50) * 100, 2),
        "above_9ema": ema_check["above_9ema"]
    }


def layer3_fibonacci_confluence(intraday_df):
    if len(intraday_df) < 20:
        return None
    last_20 = intraday_df.iloc[-20:]
    swing_high = last_20["High"].max()
    swing_high_idx = last_20["High"].idxmax()
    swing_high_bar = intraday_df.index.get_loc(swing_high_idx)
    if swing_high_bar >= len(intraday_df) - 1:
        return None
    after_high = intraday_df.iloc[swing_high_bar:]
    swing_low = after_high["Low"].min()
    fib_levels = calculate_fibonacci_levels(swing_high, swing_low)
    curr_price = intraday_df["Close"].iloc[-1]
    fib_38 = fib_levels["38.2"]
    fib_50 = fib_levels["50.0"]
    tolerance = 0.005
    in_fib_zone = (
        (fib_38 * (1 - tolerance) <= curr_price <= fib_38 * (1 + tolerance)) or
        (fib_50 * (1 - tolerance) <= curr_price <= fib_50 * (1 + tolerance))
    )
    if not in_fib_zone:
        return None
    avg_vol = intraday_df["Volume"].iloc[-21:-1].mean()
    today_vol = intraday_df["Volume"].iloc[-1]
    vol_at_fib = today_vol / avg_vol if avg_vol > 0 else 0
    if vol_at_fib < 1.5:
        return None
    pullback_pct = ((swing_high - curr_price) / swing_high) * 100
    return {
        "pullback_depth": round(pullback_pct, 2),
        "volume_at_fib": round(vol_at_fib, 2)
    }


def calculate_smart_stop_loss(entry, atr, intraday_df):
    atr_sl = entry - (atr * ATR_MULTIPLIER)
    min_distance = entry * (MIN_SL_PERCENT / 100)
    min_sl = entry - min_distance
    smart_sl = min(atr_sl, min_sl)
    recent_low = float(intraday_df["Low"].iloc[-10:].min())
    swing_sl = recent_low * 0.995
    final_sl = min(smart_sl, swing_sl)
    return {
        "sl": round(final_sl, 2),
        "risk_amount": round(entry - final_sl, 2),
        "risk_percent": round(((entry - final_sl) / entry) * 100, 2)
    }


def calculate_position_size(entry, stop_loss):
    risk_per_share = entry - stop_loss
    if risk_per_share <= 0:
        return None
    max_risk = TOTAL_CAPITAL * (RISK_PERCENT / 100)
    shares_by_risk = int(max_risk / risk_per_share)
    shares_by_investment = int(MAX_INVESTMENT_PER_TRADE / entry)
    shares = min(shares_by_risk, shares_by_investment)
    if shares < 1:
        return None
    investment = shares * entry
    max_loss = shares * risk_per_share
    return {
        "shares": shares,
        "investment": round(investment, 2),
        "max_loss": round(max_loss, 2),
        "capital_used_pct": round((investment / TOTAL_CAPITAL) * 100, 2)
    }


def time_based_filter():
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    current_time = now.hour + now.minute / 60
    return 10.0 <= current_time <= 14.5


def analyze_setup(symbol):
    daily = get_daily_data(symbol)
    if daily is None: return None
    hourly = get_hourly_data(symbol)
    if hourly is None: return None
    intraday = get_intraday_data(symbol)
    if intraday is None: return None
    
    layer1 = layer1_volume_momentum(intraday)
    if layer1 is None: return None
    layer2 = layer2_multi_timeframe(daily, hourly, intraday)
    if layer2 is None: return None
    layer3 = layer3_fibonacci_confluence(intraday)
    if layer3 is None: return None
    
    entry = float(intraday["Close"].iloc[-1])
    atr = float(intraday["atr"].iloc[-1])
    sl_data = calculate_smart_stop_loss(entry, atr, intraday)
    stop_loss = sl_data["sl"]
    risk = entry - stop_loss
    target_1_2 = entry + (risk * 2)
    target_1_3 = entry + (risk * 3)
    position = calculate_position_size(entry, stop_loss)
    
    quality_score = 0
    if layer1["vol_ratio"] >= 2.0: quality_score += 15
    if 45 <= layer1["rsi"] <= 60: quality_score += 15
    if layer1["close_strength"] >= 70: quality_score += 15
    if layer2["above_9ema"] > 0.5: quality_score += 15
    if layer3["volume_at_fib"] >= 2.0: quality_score += 15
    if sl_data["risk_percent"] >= 1.5: quality_score += 15
    if layer1["rsi_change"] >= 5: quality_score += 10
    
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    
    return {
        "symbol": symbol.replace(".NS", ""),
        "strategy": "Triple-Layer v2",
        "time": now.strftime("%I:%M %p"),
        "current_price": round(entry, 2),
        "change": round(layer1["rsi_change"], 2),
        "quality_score": quality_score,
        "layer1": layer1,
        "layer2": layer2,
        "layer3": layer3,
        "entry": round(entry, 2),
        "sl": stop_loss,
        "target": round(target_1_2, 2),
        "target_1_3": round(target_1_3, 2),
        "risk_points": round(risk, 2),
        "risk_percent": sl_data["risk_percent"],
        "position": position
    }


def send_telegram(text):
    if not BOT_TOKEN or not CHAT_ID:
        return {"ok": False, "error": "No credentials"}
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    resp = requests.post(url, json={"chat_id": CHAT_ID, "text": text, "parse_mode": "Markdown"}, timeout=10)
    return resp.json()


def main():
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    date_str = now.strftime("%d %b %Y  %I:%M %p IST")
    
    print(f"\n  Scanner v2 starting at {date_str}\n")
    
    setups = []
    in_market_hours = time_based_filter()
    
    if in_market_hours:
        for i, sym in enumerate(ALL_STOCKS, 1):
            print(f"  [{i:3d}/{len(ALL_STOCKS)}] {sym:18} ", end="", flush=True)
            result = analyze_setup(sym)
            if result:
                setups.append(result)
                print(f"✅ Q-Score: {result['quality_score']}/100")
            else:
                print("—")
    else:
        print("  Outside trading hours - no scanning")
    
    setups.sort(key=lambda x: x["quality_score"], reverse=True)
    
    # ── SAVE TO signals.json ─────────────────────────────────────────────────
    output_data = {
        "last_updated": now.isoformat(),
        "last_updated_display": date_str,
        "market_open": in_market_hours,
        "total_signals": len(setups),
        "scan_time": now.strftime("%I:%M %p"),
        "signals": setups,
        "stats": {
            "total_stocks_scanned": len(ALL_STOCKS),
            "signals_found": len(setups),
            "scanner_version": "v2-enhanced"
        }
    }
    
    with open("signals.json", "w") as f:
        json.dump(output_data, f, indent=2, default=str)
    
    print(f"\n  ✅ signals.json updated ({len(setups)} signals)")
    
    # ── SEND TELEGRAM (if signals found) ─────────────────────────────────────
    if setups and in_market_hours:
        msg  = f"🎯 *PROFESSIONAL SCANNER v2*\n"
        msg += f"📅 {date_str}\n"
        msg += f"🔴 *{len(setups)} HIGH-QUALITY SETUP(S)*\n\n"
        
        for s in setups:
            quality_emoji = "💎 ELITE" if s['quality_score'] >= 80 else ("⭐ HIGH" if s['quality_score'] >= 60 else "📊 GOOD")
            
            msg += f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            msg += f"*{s['symbol']}* — ₹{s['current_price']} | {quality_emoji}\n"
            msg += f"🎯 Quality: {s['quality_score']}/100\n\n"
            msg += f"📍 Entry: ₹{s['entry']}\n"
            msg += f"❌ SL: ₹{s['sl']} ({s['risk_percent']}%)\n"
            msg += f"🎯 T1:2 → ₹{s['target']}\n"
            msg += f"🎯 T1:3 → ₹{s['target_1_3']}\n\n"
            
            if s['position']:
                msg += f"💰 Shares: {s['position']['shares']}\n"
                msg += f"💰 Investment: ₹{s['position']['investment']:,.0f}\n\n"
        
        result = send_telegram(msg)
        if result.get("ok"):
            print(f"  ✅ Telegram alert sent!")


if __name__ == "__main__":
    main()
