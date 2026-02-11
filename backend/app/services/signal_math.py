import numpy as np
from typing import List

def calculate_derived(ch1: List[float], ch2: List[float], op: str, weights: List[float] = [1,1]) -> List[float]:
    """Combines two signals based on the selected mathematical operation."""
    a = np.array(ch1)
    b = np.array(ch2)

    # Pad with zeros if lengths differ to prevent broadcasting errors
    if len(a) != len(b):
        max_len = max(len(a), len(b))
        a = np.pad(a, (0, max_len - len(a)))
        b = np.pad(b, (0, max_len - len(b)))

    if op == "sum": return (a + b).tolist()
    if op == "diff": return (a - b).tolist()
    if op == "avg": return ((a + b) / 2).tolist()
    if op == "weighted": return ((weights[0] * a) + (weights[1] * b)).tolist()
    
    return []