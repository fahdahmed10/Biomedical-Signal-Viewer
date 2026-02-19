from pydantic import BaseModel
from datetime import date
from typing import List
from uuid import UUID


class InstrumentOption(BaseModel):
    symbol: str
    name: str

class StockDataPoint(BaseModel):
    date: date
    close: float

    class Config:
        orm_mode = True


class MarketCatalogResponse(BaseModel):
    stock: List[InstrumentOption]
    currency: List[InstrumentOption]
    mineral: List[InstrumentOption]


class MarketFetchResponse(BaseModel):
    file_id: UUID
    filename: str
    category: str
    symbol: str
    data: List[StockDataPoint]

class PredictionRequest(BaseModel):
    file_id: UUID
    days: int = 10
    model: str = "stochastic"     # stochastic

class PredictionResponse(BaseModel):
    file_id: UUID
    forecast_dates: List[date]
    forecast_values: List[float]