from datetime import datetime
from typing import Any, Dict, List
from uuid import UUID

from fastapi import HTTPException

# In-memory cache keyed by file_id returned from /stockmarket/fetch
_market_series_store: Dict[UUID, Dict[str, Any]] = {}


def store_market_series(file_id: UUID, name: str, category: str, data: List[Dict[str, Any]]) -> None:
    _market_series_store[file_id] = {
        "name": name,
        "category": category,
        "data": data,
        "created_at": datetime.now(),
    }


def get_market_series(file_id: UUID) -> List[Dict[str, Any]]:
    entry = _market_series_store.get(file_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Series not found. Please fetch market data again.")
    return entry["data"]
