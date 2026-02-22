from pydantic import BaseModel
from typing import Dict, List, Optional

class ECGResponse(BaseModel):
    time: List[float]
    channels: List[str]
    signals: Dict[str, List[float]]
    num_samples: int

class PredictionScores(BaseModel):
    Normal: float
    AFib: float
    PVC: float
    LBBB: float
    RBBB: float

class PredictionResponse(BaseModel):
    prediction: PredictionScores