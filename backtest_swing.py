"""
HONEST SWING BACKTEST — Run in Google Colab
=============================================
Tests the EXACT same logic as scanner_swing.py with REALISTIC conditions:

  ✓ Entry: next-day buy-stop (only fills if High > trigger)
  ✓ Slippage + costs: 0.3% round trip (brokerage, STT, impact)
  ✓ Conservative fills: if SL and Target hit same day → counted as LOSS
  ✓ Gap protection: skips trades that gap >2% above trigger
  ✓ Time stop: exit after 10 days if neither SL nor target hit
  ✓ Liquidity filter: same ₹10cr minimum

This gives you REAL numbers. If these look good AND 30 days of paper
trading matches, only then consider real money.

USAGE IN COLAB:
  !pip install yfinance -q
  (paste this entire file, run)
"""

import yfinance as yf
import numpy as np
import pandas as pd

# ── Same config as scanner ─────────────────────────────────────────────────────
MIN_TURNOVER_CR = 10.0
MAX_PRICE = 100
MIN_PRICE = 10
MIN_SL_PCT = 2.0
ATR_MULT = 1.5
COST_PCT = 0.003          # 0.3% round-trip costs+slippage
MAX_GAP_PCT = 2.0         # skip if opens >2% above trigger
TIME_STOP_DAYS = 10
BACKTEST_PERIOD = "2y"

BLOCKLIST = {"JPASSOCIAT.NS", "GVKPIL.NS", "RPOWER.NS", "JPPOWER.NS"}

STOCKS = [
    "YESBANK.NS", "IDFCFIRSTB.NS", "IDBI.NS", "PNB.NS", "UNIONBANK.NS",
    "IOB.NS", "CENTRALBK.NS", "UCOBANK.NS", "MAHABANK.NS", "BANKINDIA.NS",
    "INDIANB.NS", "PSB.NS", "UJJIVANSFB.NS", "SOUTHBANK.NS", "DCBBANK.NS",
    "SUZLON.NS", "NHPC.NS", "SJVN.NS", "BHEL.NS", "IRFC.NS", "RTNINDIA.NS",
    "ADANIPOWER.NS", "IDEA.NS", "HFCL.NS", "ITI.NS", "TVTODAY.NS", "DBCORP.NS",
    "NBCC.NS", "IRCON.NS", "RVNL.NS", "GMRINFRA.NS", "HUDCO.NS", "HCC.NS",
    "CGPOWER.NS", "PNCINFRA.NS", "RAYMOND.NS", "MOREPENLAB.NS", "LLOYDSME.NS",
    "AUROPHARMA.NS", "GLENMARK.NS", "INDOCO.NS", "FDC.NS", "BLISSGVS.NS",
    "JBCHEPHARM.NS", "SAIL.NS", "JINDALSTEL.NS", "WELCORP.NS", "JSL.NS",
    "RATNAMANI.NS", "JSWENERGY.NS", "GMDCLTD.NS", "MANGCHEFER.NS", "ASHOKLEY.NS",
    "TATAMOTORS.NS", "JKTYRE.NS", "CEATLTD.NS", "APOLLOTYRE.NS", "FIEMIND.NS",
    "MOTHERSON.NS", "DLF.NS", "OMAXAUTO.NS", "ANANTRAJ.NS", "SUNTECK.NS",
    "MAHINDCIE.NS", "ROUTE.NS", "INTELLECT.NS", "MASTEK.NS", "PAYTM.NS",
    "ZOMATO.NS", "TRIDENT.NS", "VARDHACRLC.NS", "ALOKINDS.NS", "WELSPUNLIV.NS",
    "BIRLATYRE.NS", "MMTC.NS", "MOIL.NS", "PAGEIND.NS", "PRAKASH.NS",
    "JINDWORLD.NS", "CGCL.NS", "ORIENTHOT.NS"
]
STOCKS = [s for s in STOCKS if s not in BLOCKLIST]


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


def prepare(symbol):
    try:
        df = yf.Ticker(symbol).history(period=BACKTEST_PERIOD, interval="1d")
        df.dropna(subset=["Close", "Volume"], inplace=True)
        if len(df) < 220:
            return None
        df["ema20"]  = df["Close"].ewm(span=20,  adjust=False).mean()
        df["ema50"]  = df["Close"].ewm(span=50,  adjust=False).mean()
        df["ema200"] = df["Close"].ewm(span=200, adjust=False).mean()
        df["rsi"]    = rsi(df["Close"])
        df["atr"]    = atr(df)
        df["turnover"] = df["Close"] * df["Volume"]
        df["avg_turnover_cr"] = df["turnover"].rolling(20).mean() / 1e7
        df["avg_vol"] = df["Volume"].rolling(20).mean()
        return df.reset_index(drop=False)
    except:
        return None


def setup_on_day(df, i):
    """Check if EXACT scanner conditions exist on bar i. Returns trade plan or None."""
    if i < 210:
        return None
    
    c, o = df["Close"].iat[i], df["Open"].iat[i]
    h, l = df["High"].iat[i], df["Low"].iat[i]
    
    if c > MAX_PRICE or c < MIN_PRICE:
        return None
    if df["avg_turnover_cr"].iat[i] < MIN_TURNOVER_CR:
        return None
    
    ema20, ema50, ema200 = df["ema20"].iat[i], df["ema50"].iat[i], df["ema200"].iat[i]
    if not (c > ema200 and ema50 > ema200):
        return None
    
    recent_low = df["Low"].iloc[i-4:i+1].min()
    if not (recent_low <= ema20 * 1.01 and c > ema20):
        return None
    
    rng = h - l
    if rng <= 0 or c <= o or (c - l) / rng < 0.5:
        return None
    
    r_now, r_3d = df["rsi"].iat[i], df["rsi"].iat[i-3]
    if not (40 <= r_now <= 65 and r_now > r_3d):
        return None
    
    av = df["avg_vol"].iat[i]
    if av <= 0 or df["Volume"].iat[i] / av < 1.2:
        return None
    
    a = df["atr"].iat[i]
    trigger = h + 0.05
    sl = min(trigger - a * ATR_MULT, trigger * (1 - MIN_SL_PCT/100), l * 0.995)
    risk = trigger - sl
    if risk <= 0 or risk / trigger > 0.06:
        return None
    
    return {"trigger": trigger, "sl": sl,
            "t1": trigger + risk * 2, "t2": trigger + risk * 3}


def simulate(symbol):
    df = prepare(symbol)
    if df is None:
        return []
    
    trades = []
    i = 210
    n = len(df)
    
    while i < n - 2:
        plan = setup_on_day(df, i)
        if plan is None:
            i += 1
            continue
        
        # ── Next day: does buy-stop trigger? ────────────────────────────────
        j = i + 1
        nh, nl, no = df["High"].iat[j], df["Low"].iat[j], df["Open"].iat[j]
        trig, sl, t1 = plan["trigger"], plan["sl"], plan["t1"]
        
        if nh < trig:
            i += 1
            continue  # never triggered — no trade
        
        # Gap protection: opened too far above trigger → skip (you'd skip too)
        if no > trig * (1 + MAX_GAP_PCT/100):
            i += 1
            continue
        
        entry = max(trig, no) * (1 + COST_PCT/2)  # fill + half cost as slippage
        
        # ── Walk forward until exit ─────────────────────────────────────────
        outcome, exit_px, exit_day = None, None, None
        for k in range(j, min(j + TIME_STOP_DAYS, n)):
            kh, kl = df["High"].iat[k], df["Low"].iat[k]
            
            # Same-day entry bar: check SL first (conservative)
            hit_sl = kl <= sl
            hit_t1 = kh >= t1
            
            if hit_sl and hit_t1:
                outcome, exit_px, exit_day = "LOSS(both)", sl, k  # conservative
                break
            if hit_sl:
                outcome, exit_px, exit_day = "LOSS", sl, k
                break
            if hit_t1:
                outcome, exit_px, exit_day = "WIN", t1, k
                break
        
        if outcome is None:  # time stop
            exit_day = min(j + TIME_STOP_DAYS, n) - 1
            exit_px = df["Close"].iat[exit_day]
            outcome = "TIME"
        
        exit_px *= (1 - COST_PCT/2)  # exit cost
        pnl_pct = (exit_px - entry) / entry * 100
        
        trades.append({
            "symbol": symbol.replace(".NS", ""),
            "entry_date": str(df["Date"].iat[j])[:10],
            "exit_date": str(df["Date"].iat[exit_day])[:10],
            "entry": round(entry, 2), "exit": round(exit_px, 2),
            "outcome": outcome, "pnl_pct": round(pnl_pct, 2),
            "days_held": exit_day - j + 1
        })
        
        i = exit_day + 1  # no overlapping trades in same stock
    
    return trades


def main():
    print(f"\n{'='*72}")
    print(f"  HONEST SWING BACKTEST — {BACKTEST_PERIOD} | Costs: {COST_PCT*100}% | Conservative fills")
    print(f"{'='*72}\n")
    
    all_trades = []
    for idx, sym in enumerate(STOCKS, 1):
        print(f"  [{idx:2d}/{len(STOCKS)}] {sym:18}", end=" ", flush=True)
        t = simulate(sym)
        all_trades.extend(t)
        print(f"{len(t)} trades")
    
    if not all_trades:
        print("\n  No trades found — filters may be too strict for this period.")
        return
    
    tdf = pd.DataFrame(all_trades)
    wins   = tdf[tdf["pnl_pct"] > 0]
    losses = tdf[tdf["pnl_pct"] <= 0]
    
    win_rate = len(wins) / len(tdf) * 100
    avg_win  = wins["pnl_pct"].mean() if len(wins) else 0
    avg_loss = losses["pnl_pct"].mean() if len(losses) else 0
    pf = abs(wins["pnl_pct"].sum() / losses["pnl_pct"].sum()) if losses["pnl_pct"].sum() != 0 else float("inf")
    expectancy = tdf["pnl_pct"].mean()
    
    # Equity curve & max drawdown (1% risk-equivalent compounding approximation)
    eq = (1 + tdf.sort_values("entry_date")["pnl_pct"]/100).cumprod()
    dd = ((eq / eq.cummax()) - 1).min() * 100
    
    print(f"\n{'='*72}")
    print(f"  REAL RESULTS (after costs & conservative fills)")
    print(f"{'='*72}")
    print(f"  Total trades:     {len(tdf)}")
    print(f"  Win rate:         {win_rate:.1f}%")
    print(f"  Avg win:          {avg_win:+.2f}%")
    print(f"  Avg loss:         {avg_loss:+.2f}%")
    print(f"  Profit factor:    {pf:.2f}")
    print(f"  Expectancy/trade: {expectancy:+.2f}%")
    print(f"  Max drawdown:     {dd:.1f}%")
    print(f"  Avg hold:         {tdf['days_held'].mean():.1f} days")
    print(f"\n  Outcome breakdown:")
    print(tdf["outcome"].value_counts().to_string())
    
    print(f"\n{'='*72}")
    print(f"  VERDICT GUIDE:")
    print(f"  • Expectancy > +0.5%/trade AND PF > 1.5  → strategy has edge, paper trade it")
    print(f"  • Expectancy +0 to +0.5%                 → marginal, costs will eat it")
    print(f"  • Expectancy negative                    → DO NOT trade this")
    print(f"{'='*72}\n")
    
    tdf.to_csv("swing_backtest_results.csv", index=False)
    print("  📄 Full trade log saved: swing_backtest_results.csv")


if __name__ == "__main__":
    main()
