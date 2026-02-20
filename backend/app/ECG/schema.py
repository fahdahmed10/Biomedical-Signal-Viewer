from pydantic import BaseModel
from typing import List, Dict, Optional


class ECGResponse(BaseModel):
    num_channels: int
    channels: List[str]
    num_samples: int
    duration: Optional[float]
    time: List[float]
    signals: Dict[str, List[float]]
