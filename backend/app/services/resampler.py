import numpy as np
from scipy import signal

def resample_signal(data: list, target_points: int = 10000) -> list:
    """
    Downsamples huge signals to prevent frontend lag.
    """
    if not data:
        return []

    current_points = len(data)
    if current_points <= target_points:
        return data

    step = current_points // target_points
    # Slicing is fastest and retains the general shape for visualization
    downsampled_data = data[::step]
    
    return list(downsampled_data)