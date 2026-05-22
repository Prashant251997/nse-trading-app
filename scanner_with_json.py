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

TOTAL_CAPITAL = float(os.environ.get("TOTAL_CAPITAL", "50000"))
RISK_PERCENT = float(os.environ.get("RISK_PERCENT", "1.0"))
MAX_INVESTMENT_PER_TRADE = float(os.environ.get("MAX_INVESTMENT", "20000"))

MIN_SL_PERCENT = 1.0
ATR_MULTIPLIER = 1.5
MIN_RSI = 40
MAX_RSI = 65

# ── Stock Universe with Sectors ────────────────────────────────────────────────
STOCK_INFO = {
    "YESBANK.NS": "Banking", "IDFCFIRSTB.NS": "Banking", "IDBI.NS": "Banking",
    "PNB.NS": "Banking", "UNIONBANK.NS": "Banking", "IOB.NS": "Banking",
    "CENTRALBK.NS": "Banking", "UCOBANK.NS": "Banking", "MAHABANK.NS": "Banking",
    "BANKINDIA.NS": "Banking", "INDIANB.NS": "Banking", "PSB.NS": "Banking",
    "UJJIVANSFB.NS": "Banking", "SOUTHBANK.NS": "Banking", "DCBBANK.NS": "Banking",
    "SUZLON.NS": "Energy", "NHPC.NS": "Energy", "SJVN.NS": "Energy",
    "BHEL.NS": "Energy", "RPOWER.NS": "Energy", "JPPOWER.NS": "Energy",
    "IRFC.NS": "Energy", "RTNINDIA.NS": "Energy", "GVKPIL.NS": "Energy",
    "ADANIPOWER.NS": "Energy", "IDEA.NS": "Telecom", "HFCL.NS": "Telecom",
    "ITI.NS": "Telecom", "TVTODAY.NS": "Telecom", "DBCORP.NS": "Telecom",
    "NBCC.NS": "Infrastructure", "IRCON.NS": "Infrastructure", "RVNL.NS": "Infrastructure",
    "GMRINFRA.NS": "Infrastructure", "JPASSOCIAT.NS": "Infrastructure", "HUDCO.NS": "Infrastructure",
    "HCC.NS": "Infrastructure", "CGPOWER.NS": "Infrastructure", "PNCINFRA.NS": "Infrastructure",
    "RAYMOND.NS": "Infrastructure", "MOREPENLAB.NS": "Pharma", "LLOYDSME.NS": "Pharma",
    "AUROPHARMA.NS": "Pharma", "GLENMARK.NS": "Pharma", "INDOCO.NS": "Pharma",
    "FDC.NS": "Pharma", "BLISSGVS.NS": "Pharma", "JBCHEPHARM.NS": "Pharma",
    "SAIL.NS": "Metals", "JINDALSTEL.NS": "Metals", "WELCORP.NS": "Metals",
    "JSL.NS": "Metals", "RATNAMANI.NS": "Metals", "JSWENERGY.NS": "Metals",
    "GMDCLTD.NS": "Metals", "MANGCHEFER.NS": "Metals", "ASHOKLEY.NS": "Auto",
    "TATAMOTORS.NS": "Auto", "JKTYRE.NS": "Auto", "CEATLTD.NS": "Auto",
    "APOLLOTYRE.NS": "Auto", "FIEMIND.NS": "Auto", "MOTHERSON.NS": "Auto",
    "DLF.NS": "Real Estate", "OMAXAUTO.NS": "Real Estate", "ANANTRAJ.NS": "Real Estate",
    "SUNTECK.NS": "Real Estate", "MAHINDCIE.NS": "Real Estate", "ROUTE.NS": "IT",
    "INTELLECT.NS": "IT", "MASTEK.NS": "IT", "PAYTM.NS": "IT", "ZOMATO.NS": "IT",
    "TRIDENT.NS": "Textile", "VARDHACRLC.NS": "Textile", "ALOKINDS.NS": "Textile",
    "WELSPUNLIV.NS": "Textile", "BIRLATYRE.NS": "Textile", "MMTC.NS": "Consumer",
    "MOIL.NS": "Mining", "PAGEIND.NS": "Consumer", "PRAKASH.NS": "Consumer",
    "JINDWORLD.NS": "Consumer", "CGCL.NS": "Consumer", "ORIENTHOT.NS": "Consumer"
}

ALL_STOCKS = list(STOCK_INFO.keys())


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
    }


# ── Get Stock Live Data (For ALL stocks) ───────────────────────────────────────
def get_stock_overview(symbol):
    """Get current price and change for any stock"""
    try:
        df = yf.Ticker(symbol).history(period="5d", interval="1d")
        if len(df) < 2:
            return None
        
        # Filter only below ₹100
        current = float(df["Close"].iloc[-1])
        if current > 100:
            return None
        
        prev_close = float(df["Close"].iloc[-2])
        change = current - prev_close
        change_pct = (change / prev_close) * 100
        
        today_vol = float(df["Volume"].iloc[-1])
        avg_vol = float(df["Volume"].iloc[-5:].mean())
        vol_ratio = today_vol / avg_vol if avg_vol > 0 else 1
        
        return {
            "symbol": symbol.replace(".NS", ""),
            "sector": STOCK_INFO.get(symbol, "Unknown"),
            "price": round(current, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "volume_ratio": round(vol_ratio, 2),
            "high": round(float(df["High"].iloc[-1]), 2),
            "low": round(float(df["Low"].iloc[-1]), 2)
        }
    except:
        return None


# ── Scanner Functions (Same as before) ─────────────────────────────────────────
def get_daily_data(symbol):
    try:
        df = yf.Ticker(symbol).history(period="1y", interval="1d")
        df.dropna(subset=["Close"], inplace=True)
        if len(df) < 200: return None
        if df["Close"].iloc[-1] > 100: return None
        df["ema200"] = df["Close"].ewm(span=200, adjust=False).mean()
        return df
    except: return None


def get_hourly_data(symbol):
    try:
        df = yf.Ticker(symbol).history(period="60d", interval="1h")
        df.dropna(subset=["Close"], inplace=True)
        if len(df) < 50: return None
        df["ema50"] = df["Close"].ewm(span=50, adjust=False).mean()
        return df
    except: return None


def get_intraday_data(symbol):
    try:
        df = yf.Ticker(symbol).history(period="5d", interval="15m")
        df.dropna(subset=["Close", "Volume"], inplace=True)
        if len(df) < 50: return None
        df["ema9"]   = df["Close"].ewm(span=9,  adjust=False).mean()
        df["ema21"]  = df["Close"].ewm(span=21, adjust=False).mean()
        df["rsi"]    = calculate_rsi(df["Close"], 14)
        df["atr"]    = calculate_atr(df, 14)
        return df
    except: return None


def check_ema_reclaim(df):
    close = float(df["Close"].iloc[-1])
    ema9 = float(df["ema9"].iloc[-1])
    ema21 = float(df["ema21"].iloc[-1])
    if close <= ema9 or close <= ema21: return None
    if ema9 <= ema21: return None
    return {"above_9ema": round(((close - ema9) / ema9) * 100, 2)}


def check_bullish_candle(df):
    o = float(df["Open"].iloc[-1])
    c = float(df["Close"].iloc[-1])
    h = float(df["High"].iloc[-1])
    l = float(df["Low"].iloc[-1])
    if c <= o: return None
    r = h - l
    if r == 0: return None
    cp = (c - l) / r
    if cp < 0.60: return None
    if abs(c - o) / r < 0.30: return None
    return {"close_position": round(cp * 100, 1)}


def check_rsi_recovery(df):
    if len(df) < 5: return None
    c = float(df["rsi"].iloc[-1])
    p = float(df["rsi"].iloc[-2])
    p3 = float(df["rsi"].iloc[-4])
    if c < MIN_RSI or c > MAX_RSI: return None
    if c <= p or c <= p3: return None
    return {"curr_rsi": round(c, 1), "rsi_change": round(c - p3, 1)}


def layer1(df):
    av = df["Volume"].iloc[-21:-1].mean()
    tv = df["Volume"].iloc[-1]
    vr = tv / av if av > 0 else 0
    if vr < 1.8 or vr > 3.0: return None
    r = check_rsi_recovery(df)
    if r is None: return None
    c = check_bullish_candle(df)
    if c is None: return None
    return {"vol_ratio": round(vr, 2), "rsi": r["curr_rsi"], "rsi_change": r["rsi_change"], "close_strength": c["close_position"]}


def layer2(daily, hourly, intraday):
    dp = float(daily["Close"].iloc[-1])
    de = float(daily["ema200"].iloc[-1])
    if dp <= de: return None
    hp = float(hourly["Close"].iloc[-1])
    he = float(hourly["ema50"].iloc[-1])
    if hp <= he: return None
    e = check_ema_reclaim(intraday)
    if e is None: return None
    return {"daily_above_ema": round(((dp - de) / de) * 100, 2), "hourly_above_ema": round(((hp - he) / he) * 100, 2), "above_9ema": e["above_9ema"]}


def layer3(df):
    if len(df) < 20: return None
    l20 = df.iloc[-20:]
    sh = l20["High"].max()
    shi = l20["High"].idxmax()
    shb = df.index.get_loc(shi)
    if shb >= len(df) - 1: return None
    ah = df.iloc[shb:]
    sl = ah["Low"].min()
    fl = calculate_fibonacci_levels(sh, sl)
    cp = df["Close"].iloc[-1]
    f38 = fl["38.2"]
    f50 = fl["50.0"]
    tol = 0.005
    if not ((f38 * (1-tol) <= cp <= f38 * (1+tol)) or (f50 * (1-tol) <= cp <= f50 * (1+tol))):
        return None
    av = df["Volume"].iloc[-21:-1].mean()
    tv = df["Volume"].iloc[-1]
    vf = tv / av if av > 0 else 0
    if vf < 1.5: return None
    return {"pullback_depth": round(((sh - cp) / sh) * 100, 2), "volume_at_fib": round(vf, 2)}


def calc_sl(entry, atr, df):
    atr_sl = entry - (atr * ATR_MULTIPLIER)
    min_sl = entry - (entry * MIN_SL_PERCENT / 100)
    smart = min(atr_sl, min_sl)
    rl = float(df["Low"].iloc[-10:].min())
    swing = rl * 0.995
    final = min(smart, swing)
    return {"sl": round(final, 2), "risk_percent": round(((entry - final) / entry) * 100, 2)}


def calc_position(entry, sl):
    rps = entry - sl
    if rps <= 0: return None
    mr = TOTAL_CAPITAL * (RISK_PERCENT / 100)
    sbr = int(mr / rps)
    sbi = int(MAX_INVESTMENT_PER_TRADE / entry)
    s = min(sbr, sbi)
    if s < 1: return None
    return {"shares": s, "investment": round(s * entry, 2), "max_loss": round(s * rps, 2)}


def time_filter():
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    ct = now.hour + now.minute / 60
    return 10.0 <= ct <= 14.5


def analyze_setup(symbol):
    daily = get_daily_data(symbol)
    if daily is None: return None
    hourly = get_hourly_data(symbol)
    if hourly is None: return None
    intraday = get_intraday_data(symbol)
    if intraday is None: return None
    
    l1 = layer1(intraday)
    if l1 is None: return None
    l2 = layer2(daily, hourly, intraday)
    if l2 is None: return None
    l3 = layer3(intraday)
    if l3 is None: return None
    
    entry = float(intraday["Close"].iloc[-1])
    atr = float(intraday["atr"].iloc[-1])
    sld = calc_sl(entry, atr, intraday)
    sl = sld["sl"]
    risk = entry - sl
    pos = calc_position(entry, sl)
    
    qs = 0
    if l1["vol_ratio"] >= 2.0: qs += 15
    if 45 <= l1["rsi"] <= 60: qs += 15
    if l1["close_strength"] >= 70: qs += 15
    if l2["above_9ema"] > 0.5: qs += 15
    if l3["volume_at_fib"] >= 2.0: qs += 15
    if sld["risk_percent"] >= 1.5: qs += 15
    if l1["rsi_change"] >= 5: qs += 10
    
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    
    return {
        "symbol": symbol.replace(".NS", ""),
        "strategy": "Triple-Layer v2",
        "time": now.strftime("%I:%M %p"),
        "current_price": round(entry, 2),
        "quality_score": qs,
        "layer1": l1, "layer2": l2, "layer3": l3,
        "entry": round(entry, 2), "sl": sl,
        "target": round(entry + (risk * 2), 2),
        "target_1_3": round(entry + (risk * 3), 2),
        "risk_points": round(risk, 2),
        "risk_percent": sld["risk_percent"],
        "position": pos
    }


def send_telegram(text):
    if not BOT_TOKEN or not CHAT_ID:
        return {"ok": False}
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    return requests.post(url, json={"chat_id": CHAT_ID, "text": text, "parse_mode": "Markdown"}, timeout=10).json()


def main():
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    date_str = now.strftime("%d %b %Y  %I:%M %p IST")
    
    print(f"\n  Scanner v2 starting at {date_str}\n")
    
    # ── COLLECT MARKET DATA FOR ALL STOCKS ───────────────────────────────────
    print("  Collecting market data for all stocks...")
    market_data = []
    for i, sym in enumerate(ALL_STOCKS, 1):
        print(f"  [{i:3d}/{len(ALL_STOCKS)}] {sym:18} ", end="", flush=True)
        overview = get_stock_overview(sym)
        if overview:
            market_data.append(overview)
            print(f"₹{overview['price']:>6.2f} ({overview['change_pct']:+.2f}%)")
        else:
            print("—")
    
    # Sort for top movers
    gainers = sorted([s for s in market_data if s['change_pct'] > 0], key=lambda x: x['change_pct'], reverse=True)[:10]
    losers = sorted([s for s in market_data if s['change_pct'] < 0], key=lambda x: x['change_pct'])[:10]
    
    # ── RUN SIGNAL DETECTION (Only during market hours) ──────────────────────
    setups = []
    in_market = time_filter()
    
    if in_market:
        print("\n  Running signal detection...")
        for i, sym in enumerate(ALL_STOCKS, 1):
            print(f"  [{i:3d}/{len(ALL_STOCKS)}] {sym:18} ", end="", flush=True)
            r = analyze_setup(sym)
            if r:
                setups.append(r)
                print(f"✅ Q-Score: {r['quality_score']}/100")
            else:
                print("—")
        setups.sort(key=lambda x: x["quality_score"], reverse=True)
    else:
        print("  Outside trading hours - signal detection skipped")
    
    # ── SAVE EVERYTHING TO signals.json ───────────────────────────────────────
    output = {
        "last_updated": now.isoformat(),
        "last_updated_display": date_str,
        "market_open": in_market,
        "total_signals": len(setups),
        "scan_time": now.strftime("%I:%M %p"),
        "signals": setups,
        "market_data": {
            "total_stocks": len(market_data),
            "advancing": len([s for s in market_data if s['change_pct'] > 0]),
            "declining": len([s for s in market_data if s['change_pct'] < 0]),
            "top_gainers": gainers,
            "top_losers": losers,
            "all_stocks": market_data
        },
        "stats": {
            "scanner_version": "v2-with-market-data"
        }
    }
    
    with open("signals.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f"\n  ✅ signals.json updated")
    print(f"     {len(setups)} signals | {len(market_data)} stocks tracked")
    
    # ── TELEGRAM ALERT ────────────────────────────────────────────────────────
    if setups and in_market:
        msg  = f"🎯 *SCANNER v2 — Signals Found*\n"
        msg += f"📅 {date_str}\n\n"
        msg += f"🔴 *{len(setups)} HIGH-QUALITY SETUP(S)*\n\n"
        
        for s in setups:
            qe = "💎 ELITE" if s['quality_score'] >= 80 else ("⭐ HIGH" if s['quality_score'] >= 60 else "📊 GOOD")
            msg += f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            msg += f"*{s['symbol']}* ₹{s['current_price']} | {qe}\n"
            msg += f"🎯 Quality: {s['quality_score']}/100\n\n"
            msg += f"📍 Entry: ₹{s['entry']}\n"
            msg += f"❌ SL: ₹{s['sl']} ({s['risk_percent']}%)\n"
            msg += f"🎯 T1:2 → ₹{s['target']}\n"
            msg += f"🎯 T1:3 → ₹{s['target_1_3']}\n\n"
            if s['position']:
                msg += f"💰 Shares: {s['position']['shares']}\n"
                msg += f"💰 Invest: ₹{s['position']['investment']:,.0f}\n\n"
        
        if send_telegram(msg).get("ok"):
            print(f"  ✅ Telegram alert sent!")


if __name__ == "__main__":
    main()
