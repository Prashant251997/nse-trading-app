"""
INTRADAY MOMENTUM SCANNER
==========================
Honest version: Uses Yahoo Finance (15-min delayed).
NOT for scalping. Designed to catch stocks already in
strong momentum moves that typically last 30min-2hrs.

Logic: If a stock has been moving strongly for 20-30 min
already, it often continues. We scan for CONFIRMED moves,
not predictions.

Run via GitHub Actions every 15 min during market hours.
"""

import yfinance as yf
import requests
from datetime import datetime
import pytz
import os
import json
import numpy as np

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
CHAT_ID   = os.environ.get("CHAT_ID",   "")

TOTAL_CAPITAL        = 50000
RISK_PERCENT         = 0.5     # Conservative for intraday
MAX_INVESTMENT       = 15000

# ── Filters ────────────────────────────────────────────────────────────────────
MIN_TURNOVER_CR      = 10.0    # Liquidity gate
MIN_MOVE_PCT         = 2.0     # Stock must have moved at least 2% today already
MAX_MOVE_PCT         = 8.0     # Avoid stocks already up >8% (chasing)
MIN_VOL_RATIO        = 1.5     # Volume must be 1.5x average
MAX_PRICE            = 100
MIN_PRICE            = 10

BLOCKLIST = {"JPASSOCIAT.NS", "GVKPIL.NS", "RPOWER.NS", "JPPOWER.NS"}

STOCK_INFO = {
    "YESBANK.NS": "Banking", "IDFCFIRSTB.NS": "Banking", "IDBI.NS": "Banking",
    "PNB.NS": "Banking", "UNIONBANK.NS": "Banking", "IOB.NS": "Banking",
    "CENTRALBK.NS": "Banking", "UCOBANK.NS": "Banking", "MAHABANK.NS": "Banking",
    "BANKINDIA.NS": "Banking", "INDIANB.NS": "Banking", "PSB.NS": "Banking",
    "UJJIVANSFB.NS": "Banking", "SOUTHBANK.NS": "Banking", "DCBBANK.NS": "Banking",
    "SUZLON.NS": "Energy", "NHPC.NS": "Energy", "SJVN.NS": "Energy",
    "BHEL.NS": "Energy", "IRFC.NS": "Energy", "RTNINDIA.NS": "Energy",
    "ADANIPOWER.NS": "Energy", "IDEA.NS": "Telecom", "HFCL.NS": "Telecom",
    "ITI.NS": "Telecom", "TVTODAY.NS": "Telecom", "DBCORP.NS": "Telecom",
    "NBCC.NS": "Infrastructure", "IRCON.NS": "Infrastructure", "RVNL.NS": "Infrastructure",
    "GMRINFRA.NS": "Infrastructure", "HUDCO.NS": "Infrastructure",
    "HCC.NS": "Infrastructure", "CGPOWER.NS": "Infrastructure",
    "PNCINFRA.NS": "Infrastructure", "RAYMOND.NS": "Infrastructure",
    "MOREPENLAB.NS": "Pharma", "LLOYDSME.NS": "Pharma", "AUROPHARMA.NS": "Pharma",
    "GLENMARK.NS": "Pharma", "INDOCO.NS": "Pharma", "FDC.NS": "Pharma",
    "BLISSGVS.NS": "Pharma", "JBCHEPHARM.NS": "Pharma", "SAIL.NS": "Metals",
    "JINDALSTEL.NS": "Metals", "WELCORP.NS": "Metals", "JSL.NS": "Metals",
    "RATNAMANI.NS": "Metals", "JSWENERGY.NS": "Metals", "GMDCLTD.NS": "Metals",
    "MANGCHEFER.NS": "Metals", "ASHOKLEY.NS": "Auto", "TATAMOTORS.NS": "Auto",
    "JKTYRE.NS": "Auto", "CEATLTD.NS": "Auto", "APOLLOTYRE.NS": "Auto",
    "FIEMIND.NS": "Auto", "MOTHERSON.NS": "Auto", "DLF.NS": "Real Estate",
    "OMAXAUTO.NS": "Real Estate", "ANANTRAJ.NS": "Real Estate",
    "SUNTECK.NS": "Real Estate", "MAHINDCIE.NS": "Real Estate",
    "ROUTE.NS": "IT", "INTELLECT.NS": "IT", "MASTEK.NS": "IT",
    "PAYTM.NS": "IT", "ZOMATO.NS": "IT", "TRIDENT.NS": "Textile",
    "VARDHACRLC.NS": "Textile", "ALOKINDS.NS": "Textile",
    "WELSPUNLIV.NS": "Textile", "BIRLATYRE.NS": "Textile",
    "MMTC.NS": "Consumer", "MOIL.NS": "Mining", "PAGEIND.NS": "Consumer",
    "PRAKASH.NS": "Consumer", "JINDWORLD.NS": "Consumer",
    "CGCL.NS": "Consumer", "ORIENTHOT.NS": "Consumer"
}
ALL_STOCKS = [s for s in STOCK_INFO if s not in BLOCKLIST]


def rsi(series, period=14):
    delta = series.diff()
    gain = delta.where(delta > 0, 0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def atr(df, period=14):
    tr = np.maximum(df["High"] - df["Low"],
         np.maximum(abs(df["High"] - df["Close"].shift()),
                    abs(df["Low"] - df["Close"].shift())))
    return tr.rolling(period).mean()


def get_intraday(symbol):
    """5-min bars for today. Yahoo delay = 15 min."""
    try:
        df = yf.Ticker(symbol).history(period="5d", interval="5m")
        df.dropna(subset=["Close", "Volume"], inplace=True)
        if len(df) < 20:
            return None
        return df
    except:
        return None


def get_daily(symbol):
    """Daily bars for context (EMA200, avg turnover)."""
    try:
        df = yf.Ticker(symbol).history(period="1y", interval="1d")
        df.dropna(subset=["Close", "Volume"], inplace=True)
        if len(df) < 50:
            return None
        df["ema200"]   = df["Close"].ewm(span=200, adjust=False).mean()
        df["turnover"] = df["Close"] * df["Volume"]
        return df
    except:
        return None


def analyze(symbol):
    daily = get_daily(symbol)
    if daily is None:
        return None, None

    curr_price = float(daily["Close"].iloc[-1])
    if curr_price > MAX_PRICE or curr_price < MIN_PRICE:
        return None, None

    # Liquidity check
    avg_turnover_cr = daily["turnover"].iloc[-20:].mean() / 1e7
    if avg_turnover_cr < MIN_TURNOVER_CR:
        return None, None

    # Daily trend context
    ema200 = float(daily["ema200"].iloc[-1])
    above_200ema = curr_price > ema200

    # Intraday data
    intra = get_intraday(symbol)
    if intra is None:
        return None, None

    # Today's open (first bar of today)
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    today_str = now.strftime("%Y-%m-%d")

    today_bars = intra[intra.index.tz_convert(ist).strftime("%Y-%m-%d") == today_str]
    if len(today_bars) < 3:
        return None, None

    day_open  = float(today_bars["Open"].iloc[0])
    day_high  = float(today_bars["High"].max())
    day_low   = float(today_bars["Low"].min())
    curr      = float(today_bars["Close"].iloc[-1])

    # Move from open
    move_pct = (curr - day_open) / day_open * 100

    # Build overview regardless of signal
    prev_close = float(daily["Close"].iloc[-2]) if len(daily) > 1 else day_open
    overview = {
        "symbol": symbol.replace(".NS", ""),
        "sector": STOCK_INFO.get(symbol, "Stock"),
        "price": round(curr, 2),
        "change_pct": round((curr - prev_close) / prev_close * 100, 2),
        "move_from_open": round(move_pct, 2),
        "volume_ratio": round(
            float(today_bars["Volume"].sum()) /
            max(float(daily["Volume"].iloc[-20:].mean()), 1), 2
        ),
        "high": round(day_high, 2),
        "low": round(day_low, 2)
    }

    # ── SIGNAL FILTERS ─────────────────────────────────────────────────────────

    # Must have moved meaningfully (confirms real momentum)
    if not (MIN_MOVE_PCT <= move_pct <= MAX_MOVE_PCT):
        return None, overview

    # Volume must confirm the move
    today_vol  = float(today_bars["Volume"].sum())
    avg_vol    = float(daily["Volume"].iloc[-20:].mean())
    vol_ratio  = today_vol / avg_vol if avg_vol > 0 else 0
    if vol_ratio < MIN_VOL_RATIO:
        return None, overview

    # Price must be above 200-EMA (only trade in uptrend)
    if not above_200ema:
        return None, overview

    # RSI on 5-min bars: not overbought
    intra["rsi"] = rsi(intra["Close"], 14)
    curr_rsi = float(intra["rsi"].iloc[-1])
    if curr_rsi > 75:
        return None, overview  # already overbought — too late

    # Current price must be near today's high (momentum continuing)
    range_pct = (curr - day_low) / (day_high - day_low) if (day_high - day_low) > 0 else 0
    if range_pct < 0.6:
        return None, overview  # pulling back, not leading

    # ── ENTRY / SL / TARGET ────────────────────────────────────────────────────
    intra["atr"] = atr(intra, 14)
    atr_val = float(intra["atr"].iloc[-1])

    entry  = curr
    sl     = max(day_low * 0.995, entry - atr_val * 1.5)
    sl     = min(sl, entry * 0.97)          # max 3% SL for intraday
    risk   = entry - sl

    if risk <= 0 or risk / entry > 0.04:    # reject >4% risk
        return None, overview

    t1 = round(entry + risk * 1.5, 2)       # 1:1.5 (realistic intraday)
    t2 = round(entry + risk * 2.5, 2)       # 1:2.5 (if strong)

    # Position sizing
    max_risk_amt = TOTAL_CAPITAL * RISK_PERCENT / 100
    shares = min(
        int(max_risk_amt / risk),
        int(MAX_INVESTMENT / entry)
    )
    position = None
    if shares >= 1:
        position = {
            "shares": shares,
            "investment": round(shares * entry, 2),
            "max_loss": round(shares * risk, 2)
        }

    # Quality score
    q = 0
    if avg_turnover_cr >= 25: q += 25
    elif avg_turnover_cr >= 15: q += 15
    if 2.5 <= move_pct <= 5: q += 25        # sweet spot: moving but not extended
    if vol_ratio >= 2.0: q += 25
    if curr_rsi <= 65: q += 25              # room to run

    signal = {
        "symbol": symbol.replace(".NS", ""),
        "strategy": "Intraday Momentum",
        "time": now.strftime("%I:%M %p"),
        "current_price": round(curr, 2),
        "quality_score": q,
        "turnover_cr": round(avg_turnover_cr, 1),
        "move_from_open": round(move_pct, 2),
        "vol_ratio": round(vol_ratio, 2),
        "rsi": round(curr_rsi, 1),
        "entry": round(entry, 2),
        "sl": round(sl, 2),
        "target": t1,
        "target_1_3": t2,
        "risk_points": round(risk, 2),
        "risk_percent": round(risk / entry * 100, 2),
        "position": position,
        "hold_period": "30 min - 2 hrs (exit before 3 PM)",
        "warning": "Data is ~15 min delayed. Verify price before entry.",
        "layer1": {
            "vol_ratio": round(vol_ratio, 2),
            "rsi": round(curr_rsi, 1),
            "close_strength": round(range_pct * 100, 1)
        }
    }
    return signal, overview


def in_market_hours():
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    ct  = now.hour * 60 + now.minute
    # 9:45 AM to 2:30 PM (avoid open 30 min + avoid last hour)
    return 585 <= ct <= 870


def send_telegram(text):
    if not BOT_TOKEN or not CHAT_ID:
        return {"ok": False}
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    return requests.post(url, json={
        "chat_id": CHAT_ID, "text": text, "parse_mode": "Markdown"
    }, timeout=10).json()


def main():
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    date_str = now.strftime("%d %b %Y  %I:%M %p IST")

    print(f"\n{'='*70}")
    print(f"  INTRADAY MOMENTUM SCANNER — {date_str}")
    print(f"  ⚠️  Data is ~15 min delayed")
    print(f"{'='*70}\n")

    if not in_market_hours():
        print("  Outside scanning window (9:45 AM - 2:30 PM). Skipping.")
        return

    signals, market_data = [], []

    for i, sym in enumerate(ALL_STOCKS, 1):
        print(f"  [{i:3d}/{len(ALL_STOCKS)}] {sym:18} ", end="", flush=True)
        sig, overview = analyze(sym)
        if overview:
            market_data.append(overview)
        if sig:
            signals.append(sig)
            print(f"✅ {sig['move_from_open']:+.1f}% | Vol {sig['vol_ratio']:.1f}x | RSI {sig['rsi']}")
        else:
            print("—")

    signals.sort(key=lambda x: x["quality_score"], reverse=True)

    gainers = sorted(market_data, key=lambda x: x["change_pct"], reverse=True)[:10]
    losers  = sorted(market_data, key=lambda x: x["change_pct"])[:10]

    # Save signals.json (app reads this)
    output = {
        "last_updated": now.isoformat(),
        "last_updated_display": date_str,
        "market_open": True,
        "total_signals": len(signals),
        "scan_time": now.strftime("%I:%M %p"),
        "data_delay_warning": "Yahoo Finance data is ~15 min delayed",
        "signals": signals,
        "market_data": {
            "total_stocks": len(market_data),
            "advancing": len([s for s in market_data if s["change_pct"] > 0]),
            "declining": len([s for s in market_data if s["change_pct"] < 0]),
            "top_gainers": gainers,
            "top_losers":  losers,
            "all_stocks":  market_data
        }
    }
    with open("signals.json", "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\n  ✅ signals.json saved | {len(signals)} signals | {len(market_data)} stocks")

    if not signals:
        print("  No momentum setups found this scan.")
        return

    # Telegram
    msg  = f"⚡ *INTRADAY MOMENTUM ALERT*\n"
    msg += f"📅 {date_str}\n"
    msg += f"⚠️ _Data ~15 min delayed — verify price before entry_\n\n"
    msg += f"🔴 *{len(signals)} SETUP(S) IN MOTION*\n\n"

    for s in signals:
        qe = "💎" if s["quality_score"] >= 75 else "⭐" if s["quality_score"] >= 50 else "📊"
        msg += f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        msg += f"{qe} *{s['symbol']}* — ₹{s['current_price']}\n"
        msg += f"📈 Up {s['move_from_open']:+.1f}% from open | Vol {s['vol_ratio']:.1f}× | RSI {s['rsi']}\n"
        msg += f"Liquidity: ₹{s['turnover_cr']}cr/day\n\n"
        msg += f"*📍 IF YOU LIKE THE SETUP:*\n"
        msg += f"  Check live price first (open broker)\n"
        msg += f"  Entry near: ₹{s['entry']}\n"
        msg += f"  Stop Loss: ₹{s['sl']} ({s['risk_percent']}%)\n"
        msg += f"  Target 1: ₹{s['target']} (1:1.5 — book 70%)\n"
        msg += f"  Target 2: ₹{s['target_1_3']} (1:2.5 — book rest)\n"
        msg += f"  Exit: Before 3:00 PM no matter what\n\n"
        if s["position"]:
            p = s["position"]
            msg += f"💰 Qty: {p['shares']} shares = ₹{p['investment']:,.0f}\n"
            msg += f"🛡️ Max loss: ₹{p['max_loss']:,.0f}\n\n"

    msg += f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"⚠️ *INTRADAY RULES:*\n"
    msg += f"• Always check live price before entering\n"
    msg += f"• Data is delayed — price may have moved\n"
    msg += f"• Exit ALL positions before 3:00 PM\n"
    msg += f"• Never hold intraday positions overnight\n"
    msg += f"• If stock already moved >8% — skip it"

    if send_telegram(msg).get("ok"):
        print("  ✅ Telegram alert sent!")


if __name__ == "__main__":
    main()
