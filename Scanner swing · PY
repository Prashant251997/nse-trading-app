"""
SWING SCANNER — End-of-Day System (Honest Edition)
====================================================
Runs AFTER market close (4:15 PM IST). Signals are for NEXT DAY entry
via buy-stop orders. This makes Yahoo's 15-min delay irrelevant.

Filters:
  1. LIQUIDITY: 20-day avg turnover >= ₹10 crore (no circuit traps)
  2. TREND: Close > EMA200, EMA50 > EMA200 (only uptrends)
  3. SETUP: Pullback to EMA20 zone + bullish reversal candle
  4. MOMENTUM: RSI 40-65 and rising
  5. VOLUME: >= 1.2x average (confirmation, not mania)
  6. RISK: SL at least 2% away, ATR-based, below setup low

Entry method: Buy-stop above today's high (only triggers if momentum continues)
"""

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
RISK_PERCENT  = float(os.environ.get("RISK_PERCENT", "0.5"))   # Conservative default
MAX_INVESTMENT_PER_TRADE = float(os.environ.get("MAX_INVESTMENT", "20000"))

MIN_TURNOVER_CR = 10.0    # Minimum ₹10 crore avg daily turnover
MAX_PRICE = 100           # Below ₹100 universe
MIN_PRICE = 10            # Avoid sub-₹10 manipulation zone
MIN_SL_PCT = 2.0          # Minimum 2% stop distance (swing needs room)
ATR_MULT = 1.5

# Known bankruptcy / extreme-risk names — hard blocked regardless of liquidity
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
ALL_STOCKS = [s for s in STOCK_INFO if s not in BLOCKLIST]


# ── Indicators ─────────────────────────────────────────────────────────────────
def rsi(series, period=14):
    delta = series.diff()
    gain = delta.where(delta > 0, 0).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(period).mean()
    return 100 - (100 / (1 + gain / loss))


def atr(df, period=14):
    tr = np.maximum(df["High"] - df["Low"],
         np.maximum(abs(df["High"] - df["Close"].shift()),
                    abs(df["Low"] - df["Close"].shift())))
    return tr.rolling(period).mean()


def get_data(symbol):
    try:
        df = yf.Ticker(symbol).history(period="1y", interval="1d")
        df.dropna(subset=["Close", "Volume"], inplace=True)
        if len(df) < 210:
            return None
        df["ema20"]  = df["Close"].ewm(span=20,  adjust=False).mean()
        df["ema50"]  = df["Close"].ewm(span=50,  adjust=False).mean()
        df["ema200"] = df["Close"].ewm(span=200, adjust=False).mean()
        df["rsi"]    = rsi(df["Close"])
        df["atr"]    = atr(df)
        df["turnover"] = df["Close"] * df["Volume"]
        return df
    except:
        return None


# ── THE LIQUIDITY FILTER (most important fix) ──────────────────────────────────
def passes_liquidity(df):
    avg_turnover_cr = df["turnover"].iloc[-20:].mean() / 1e7  # to crore
    return avg_turnover_cr >= MIN_TURNOVER_CR, round(avg_turnover_cr, 1)


# ── Swing Setup Detection (EOD) ────────────────────────────────────────────────
def analyze_swing(symbol):
    df = get_data(symbol)
    if df is None:
        return None, None
    
    c  = float(df["Close"].iloc[-1])
    o  = float(df["Open"].iloc[-1])
    h  = float(df["High"].iloc[-1])
    l  = float(df["Low"].iloc[-1])
    
    # Price band
    if c > MAX_PRICE or c < MIN_PRICE:
        return None, None
    
    # Overview for watchlist (collected regardless of signal)
    prev_c = float(df["Close"].iloc[-2])
    overview = {
        "symbol": symbol.replace(".NS", ""),
        "sector": STOCK_INFO.get(symbol, "Stock"),
        "price": round(c, 2),
        "change": round(c - prev_c, 2),
        "change_pct": round((c - prev_c) / prev_c * 100, 2),
        "volume_ratio": round(float(df["Volume"].iloc[-1]) / max(float(df["Volume"].iloc[-21:-1].mean()), 1), 2),
        "high": round(h, 2), "low": round(l, 2)
    }
    
    # FILTER 1: Liquidity
    liquid, turnover_cr = passes_liquidity(df)
    if not liquid:
        return None, overview
    
    ema20  = float(df["ema20"].iloc[-1])
    ema50  = float(df["ema50"].iloc[-1])
    ema200 = float(df["ema200"].iloc[-1])
    
    # FILTER 2: Established uptrend
    if not (c > ema200 and ema50 > ema200):
        return None, overview
    
    # FILTER 3: Pullback to EMA20 zone, then reclaim
    recent_low = float(df["Low"].iloc[-5:].min())
    touched_ema20 = recent_low <= ema20 * 1.01     # pulled back into/near EMA20
    reclaimed = c > ema20                           # closed back above it
    if not (touched_ema20 and reclaimed):
        return None, overview
    
    # FILTER 4: Bullish reversal candle today
    rng = h - l
    if rng <= 0 or c <= o:
        return None, overview
    close_pos = (c - l) / rng
    if close_pos < 0.5:
        return None, overview
    
    # FILTER 5: RSI 40-65 and rising
    r_now = float(df["rsi"].iloc[-1])
    r_3d  = float(df["rsi"].iloc[-4])
    if not (40 <= r_now <= 65 and r_now > r_3d):
        return None, overview
    
    # FILTER 6: Volume confirmation (mild — avoid mania spikes)
    avg_vol = float(df["Volume"].iloc[-21:-1].mean())
    vol_ratio = float(df["Volume"].iloc[-1]) / avg_vol if avg_vol > 0 else 0
    if vol_ratio < 1.2:
        return None, overview
    
    # ── ENTRY / SL / TARGETS (for NEXT day) ────────────────────────────────────
    a = float(df["atr"].iloc[-1])
    trigger = round(h + 0.05, 2)                    # buy-stop above today's high
    
    sl_candidates = [
        trigger - a * ATR_MULT,                     # ATR-based
        trigger * (1 - MIN_SL_PCT / 100),           # minimum 2% away
        l * 0.995                                   # below setup candle low
    ]
    sl = round(min(sl_candidates), 2)               # most conservative (widest)
    risk = trigger - sl
    if risk <= 0 or risk / trigger > 0.06:          # reject >6% risk setups
        return None, overview
    
    t1 = round(trigger + risk * 2, 2)
    t2 = round(trigger + risk * 3, 2)
    
    # Position sizing
    max_risk_amt = TOTAL_CAPITAL * RISK_PERCENT / 100
    shares = min(int(max_risk_amt / risk), int(MAX_INVESTMENT_PER_TRADE / trigger))
    position = None
    if shares >= 1:
        position = {
            "shares": shares,
            "investment": round(shares * trigger, 2),
            "max_loss": round(shares * risk, 2)
        }
    
    # Quality score
    q = 0
    if turnover_cr >= 25: q += 20
    elif turnover_cr >= 15: q += 10
    if 45 <= r_now <= 60: q += 20
    if close_pos >= 0.7: q += 20
    if 1.3 <= vol_ratio <= 2.5: q += 20
    if (c - ema200) / ema200 < 0.15: q += 20      # not over-extended
    
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    
    signal = {
        "symbol": symbol.replace(".NS", ""),
        "strategy": "Swing EOD",
        "time": now.strftime("%d %b"),
        "current_price": round(c, 2),
        "quality_score": q,
        "turnover_cr": turnover_cr,
        "entry": trigger,
        "entry_note": "BUY-STOP order: triggers only if price crosses this tomorrow",
        "sl": sl,
        "target": t1,
        "target_1_3": t2,
        "risk_points": round(risk, 2),
        "risk_percent": round(risk / trigger * 100, 2),
        "layer1": {"vol_ratio": round(vol_ratio, 2), "rsi": round(r_now, 1)},
        "position": position,
        "hold_period": "2-10 trading days"
    }
    return signal, overview


def send_telegram(text):
    if not BOT_TOKEN or not CHAT_ID:
        return {"ok": False}
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    return requests.post(url, json={"chat_id": CHAT_ID, "text": text,
                                    "parse_mode": "Markdown"}, timeout=10).json()


def main():
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    date_str = now.strftime("%d %b %Y  %I:%M %p IST")
    
    print(f"\n{'='*70}")
    print(f"  SWING SCANNER (EOD) — {date_str}")
    print(f"  Liquidity filter: ≥₹{MIN_TURNOVER_CR} cr/day | Risk: {RISK_PERCENT}%/trade")
    print(f"{'='*70}\n")
    
    signals, market_data = [], []
    
    for i, sym in enumerate(ALL_STOCKS, 1):
        print(f"  [{i:3d}/{len(ALL_STOCKS)}] {sym:18} ", end="", flush=True)
        sig, overview = analyze_swing(sym)
        if overview:
            market_data.append(overview)
        if sig:
            signals.append(sig)
            print(f"✅ SETUP (Q:{sig['quality_score']}, ₹{sig['turnover_cr']}cr/day)")
        else:
            print("—")
    
    signals.sort(key=lambda x: x["quality_score"], reverse=True)
    gainers = sorted([s for s in market_data if s["change_pct"] > 0],
                     key=lambda x: x["change_pct"], reverse=True)[:10]
    losers = sorted([s for s in market_data if s["change_pct"] < 0],
                    key=lambda x: x["change_pct"])[:10]
    
    # Save signals.json (same schema — app keeps working)
    output = {
        "last_updated": now.isoformat(),
        "last_updated_display": date_str,
        "market_open": False,
        "total_signals": len(signals),
        "scan_time": now.strftime("%I:%M %p"),
        "signals": signals,
        "market_data": {
            "total_stocks": len(market_data),
            "advancing": len([s for s in market_data if s["change_pct"] > 0]),
            "declining": len([s for s in market_data if s["change_pct"] < 0]),
            "top_gainers": gainers,
            "top_losers": losers,
            "all_stocks": market_data
        },
        "stats": {"scanner_version": "swing-eod-v1"}
    }
    with open("signals.json", "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\n  ✅ signals.json saved ({len(signals)} setups, {len(market_data)} stocks)")
    
    # Telegram
    if signals:
        msg  = f"🌙 *SWING SETUPS FOR TOMORROW*\n📅 {date_str}\n\n"
        msg += f"📋 *{len(signals)} setup(s)* — place these orders tomorrow morning:\n\n"
        
        for s in signals:
            qe = "💎" if s["quality_score"] >= 80 else "⭐" if s["quality_score"] >= 60 else "📊"
            msg += f"━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            msg += f"{qe} *{s['symbol']}* — Close ₹{s['current_price']} | Liquidity ₹{s['turnover_cr']}cr/day\n"
            msg += f"Quality: {s['quality_score']}/100\n\n"
            msg += f"📋 *ORDER TO PLACE (9:15 AM):*\n"
            msg += f"  Type: *BUY STOP-LIMIT (SL-M)*\n"
            msg += f"  Trigger: *₹{s['entry']}* (only fills if price rises here)\n"
            msg += f"  Stop Loss: ₹{s['sl']} ({s['risk_percent']}% risk)\n"
            msg += f"  Target 1: ₹{s['target']} (book 50%)\n"
            msg += f"  Target 2: ₹{s['target_1_3']} (book rest)\n"
            msg += f"  Hold: {s['hold_period']}\n\n"
            if s["position"]:
                p = s["position"]
                msg += f"💰 Qty: *{p['shares']} shares* = ₹{p['investment']:,.0f}\n"
                msg += f"🛡️ Max loss if SL hits: ₹{p['max_loss']:,.0f}\n\n"
        
        msg += f"━━━━━━━━━━━━━━━━━━━━━━━━\n"
        msg += f"⚠️ *RULES:*\n"
        msg += f"• If order doesn't trigger tomorrow → cancel by 3 PM, setup expired\n"
        msg += f"• Never chase: if price gaps >2% above trigger, skip the trade\n"
        msg += f"• Exit at SL without hesitation\n"
    else:
        msg = f"🌙 *SWING SCANNER — {date_str}*\n\nNo setups today. Filters held firm — that's discipline, not failure. 📊"
    
    if send_telegram(msg).get("ok"):
        print("  ✅ Telegram sent!")


if __name__ == "__main__":
    main()
