from datetime import date
from io import BytesIO
from pathlib import Path
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


def parse_uploaded_market_file(file_bytes: bytes, filename: str) -> tuple[List[Dict[str, object]], str]:
    extension = Path(filename or "").suffix.lower()

    if extension == ".csv":
        frame = pd.read_csv(BytesIO(file_bytes))
    elif extension in {".xlsx", ".xls"}:
        frame = pd.read_excel(BytesIO(file_bytes))
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use CSV or Excel (.xlsx/.xls)")

    if frame.empty:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    frame.columns = [str(col).strip() for col in frame.columns]
    normalized = {col: col.strip().lower() for col in frame.columns}

    date_candidates = {"date", "datetime", "timestamp", "time"}
    close_candidates = {"close", "adj close", "adj_close", "price", "last", "value"}

    date_col = next((col for col in frame.columns if normalized[col] in date_candidates), frame.columns[0])
    close_col = next((col for col in frame.columns if normalized[col] in close_candidates), None)

    if close_col is None:
        numeric_cols = [
            col for col in frame.columns if col != date_col and pd.api.types.is_numeric_dtype(frame[col])
        ]
        if not numeric_cols:
            raise HTTPException(
                status_code=400,
                detail="Could not detect a price column. Add one named 'close' or provide a numeric price column",
            )
        close_col = numeric_cols[0]

    parsed = frame[[date_col, close_col]].copy()
    parsed[date_col] = pd.to_datetime(parsed[date_col], errors="coerce")
    parsed[close_col] = pd.to_numeric(parsed[close_col], errors="coerce")
    parsed = parsed.dropna(subset=[date_col, close_col]).sort_values(by=date_col)

    if parsed.empty:
        raise HTTPException(status_code=400, detail="No valid rows found after parsing date and price columns")

    records: List[Dict[str, object]] = []
    for _, row in parsed.iterrows():
        ts = row[date_col]
        price = row[close_col]
        if pd.isna(ts) or pd.isna(price):
            continue
        records.append({"date": ts.date(), "close": float(price)})

    if not records:
        raise HTTPException(status_code=400, detail="No valid rows could be extracted from uploaded file")

    inferred_symbol = Path(filename or "uploaded_series").stem.upper() or "UPLOADED_SERIES"
    return records, inferred_symbol
