from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from uuid import uuid4
from datetime import timedelta
import pandas as pd

from app.StockMarket.schemas.stock import (
    MarketCatalogResponse,
    MarketFetchResponse,
    PredictionRequest,
    PredictionResponse
)
from app.StockMarket.services.storage_service import store_market_series, get_market_series
from app.StockMarket.services.prediction_service import predict_prices
from app.StockMarket.services.market_data_service import (
    fetch_market_data,
    get_market_catalog,
    parse_uploaded_market_file,
)

router = APIRouter(prefix="/stockmarket", tags=["Stock Market"])


@router.get("/catalog", response_model=MarketCatalogResponse)
async def get_catalog():
    """Return supported real symbols for stock, currency and mineral categories."""
    catalog = get_market_catalog()
    return MarketCatalogResponse(**catalog)


@router.post("/fetch", response_model=MarketFetchResponse)
async def fetch_live_data(symbol: str = Form(...), category: str = Form(...), period: str = Form("2y")):
    """
    Fetch real historical data for a selected symbol/category from market provider.
    Stores the fetched time-series in memory and returns a file_id for prediction.
    """
    data = fetch_market_data(symbol=symbol, category=category, period=period)
    file_id = uuid4()
    virtual_filename = f"{symbol}_{period}.csv"
    store_market_series(file_id=file_id, name=virtual_filename, category=category, data=data)

    return MarketFetchResponse(
        file_id=file_id,
        filename=virtual_filename,
        category=category,
        symbol=symbol,
        data=data
    )


@router.post("/upload", response_model=MarketFetchResponse)
async def upload_market_file(file: UploadFile = File(...)):
    """
    Upload a local market time-series file (CSV or Excel).
    This runs in parallel with /fetch and does not replace live API fetching.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename in uploaded file")

    file_bytes = await file.read()
    data, symbol = parse_uploaded_market_file(file_bytes=file_bytes, filename=file.filename)

    file_id = uuid4()
    store_market_series(file_id=file_id, name=file.filename, category="uploaded", data=data)

    return MarketFetchResponse(
        file_id=file_id,
        filename=file.filename,
        category="uploaded",
        symbol=symbol,
        data=data,
    )

@router.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Generate a forecast for the data previously uploaded with the given file_id.
    Returns predicted dates and values.
    """
    data = get_market_series(request.file_id)
    
    if len(data) < 30:
        raise HTTPException(
            status_code=400,
            detail="Not enough data points (need at least 30 for prediction)"
        )
    
    # Use a larger lookback window for better trend/volatility context
    # (about 2 trading years max, or all if shorter)
    lookback = min(len(data), 504)
    prices = [d["close"] for d in data[-lookback:]]
    forecast = predict_prices(prices, request.days, request.model)
    
    # Generate future business days to align with trading timelines
    last_date = data[-1]["date"]
    future_dates = [
        d.date() for d in pd.bdate_range(start=last_date + timedelta(days=1), periods=request.days)
    ]
    
    return PredictionResponse(
        file_id=request.file_id,
        forecast_dates=future_dates,
        forecast_values=forecast
    )