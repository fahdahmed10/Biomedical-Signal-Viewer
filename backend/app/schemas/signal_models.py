from pydantic import BaseModel
from typing import List, Optional

# --- Output to Frontend ---
class ChannelData(BaseModel):
    name: str               # e.g., "ECG Lead I", "EEG Fp1"
    values: List[float]     # The signal data points

class SignalResponse(BaseModel):
    filename: str
    sampling_rate: float
    duration: float
    total_samples: int
    n_channels: int         # Dynamically caught number of channels
    time_axis: List[float]  # Shared X-axis for plotting
    channels: List[ChannelData]

# --- Input from Frontend ---
class DerivedSignalRequest(BaseModel):
    channel_1: List[float]
    channel_2: List[float]
    operation: str          # "sum", "diff", "avg", "weighted"
    weights: Optional[List[float]] = [1.0, 1.0]