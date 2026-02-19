from datetime import date
from typing import Dict, List

import pandas as pd
import yfinance as yf
from fastapi import HTTPException

MARKET_CATALOG: Dict[str, List[Dict[str, str]]] = {
    "stock": [
        {"symbol": "AAPL", "name": "Apple"},
        {"symbol": "MSFT", "name": "Microsoft"},
        {"symbol": "GOOGL", "name": "Alphabet"},
        {"symbol": "AMZN", "name": "Amazon"},
        {"symbol": "TSLA", "name": "Tesla"},
    ],
    "currency": [
        {"symbol": "EURUSD=X", "name": "EUR/USD"},
        {"symbol": "GBPUSD=X", "name": "GBP/USD"},
        {"symbol": "USDJPY=X", "name": "USD/JPY"},
        {"symbol": "AUDUSD=X", "name": "AUD/USD"},
        {"symbol": "USDCAD=X", "name": "USD/CAD"},
        {"symbol": "USDEGP=X", "name": "USD/EGP"},
    ],
    "mineral": [
        {"symbol": "GC=F", "name": "Gold Futures"},
        {"symbol": "SI=F", "name": "Silver Futures"},
        {"symbol": "HG=F", "name": "Copper Futures"},
        {"symbol": "PL=F", "name": "Platinum Futures"},
        {"symbol": "PA=F", "name": "Palladium Futures"},
    ],
}

ALLOWED_PERIODS = {"1d","6mo", "1y", "2y", "5y", "10y", "max"}


def get_market_catalog() -> Dict[str, List[Dict[str, str]]]:
    return MARKET_CATALOG


def _is_symbol_in_category(symbol: str, category: str) -> bool:
    options = MARKET_CATALOG.get(category, [])
    return any(option["symbol"] == symbol for option in options)


def fetch_market_data(symbol: str, category: str, period: str = "2y") -> List[Dict[str, object]]:
    if category not in MARKET_CATALOG:
        raise HTTPException(status_code=400, detail="Invalid category. Use stock, currency, or mineral")

    if not _is_symbol_in_category(symbol, category):
        raise HTTPException(status_code=400, detail="Symbol does not belong to selected category")

    if period not in ALLOWED_PERIODS:
        raise HTTPException(status_code=400, detail=f"Invalid period. Allowed values: {sorted(ALLOWED_PERIODS)}")

    try:
        history = yf.Ticker(symbol).history(period=period, interval="1d", auto_adjust=False)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not download market data: {exc}") from exc

    if history.empty or "Close" not in history.columns:
        raise HTTPException(status_code=404, detail="No historical data returned for this symbol")

    frame = history[["Close"]].rename(columns={"Close": "close"}).copy()
    frame = frame.reset_index()

    date_column = frame.columns[0]
    frame[date_column] = pd.to_datetime(frame[date_column], errors="coerce")
    frame = frame.dropna(subset=[date_column, "close"])

    records: List[Dict[str, object]] = []
    for _, row in frame.iterrows():
        ts = row[date_column]
        price = row["close"]
        if pd.isna(ts) or pd.isna(price):
            continue
        records.append({"date": ts.date() if hasattr(ts, "date") else date.fromisoformat(str(ts)[:10]), "close": float(price)})


    return records
