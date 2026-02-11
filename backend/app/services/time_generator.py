import numpy as np
from typing import List

def generate_time_axis(samples_count: int, sampling_rate: float) -> List[float]:
    """Generates a time axis based on the sampling frequency."""
    if sampling_rate <= 0:
        sampling_rate = 1.0
    
    time_array = np.arange(samples_count) / sampling_rate
    return time_array.tolist()

def detect_sampling_rate(time_column: List[float]) -> float:
    """Calculates Fs (1/T) from an existing time array."""
    if len(time_column) < 2:
        return 1.0
    diffs = np.diff(time_column)
    avg_diff = np.mean(diffs)
    return round(1.0 / avg_diff, 2) if avg_diff != 0 else 1.0