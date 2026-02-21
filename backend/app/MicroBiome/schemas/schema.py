from pydantic import BaseModel
from typing import List, Dict


class ProfilingOutput(BaseModel):
    participant_id: str
    weeks: List[float]
    fecalcal: List[float]
    top5_bacteria: Dict[str, List[float]]
    top5_names: List[str]
    healthy_index: List[float]
    shannon_index: List[float]
    pca_x: List[float]
    pca_y: List[float]
    protective_bacteria : Dict[str, List[float]]
    opportunistic_bacteria : Dict[str, List[float]]
