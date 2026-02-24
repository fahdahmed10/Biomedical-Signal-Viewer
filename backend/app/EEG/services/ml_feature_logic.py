import numpy as np
import pandas as pd
import scipy.signal as signal
import warnings

warnings.filterwarnings('ignore')

# Constants
SAMPLING_RATE = 200
PAIRS_LEFT = [('Fp1', 'F7'), ('F7', 'T3'), ('T3', 'T5'), ('T5', 'O1'), ('Fp1', 'F3'), ('F3', 'C3'), ('C3', 'P3'), ('P3', 'O1')]
PAIRS_RIGHT = [('Fp2', 'F8'), ('F8', 'T4'), ('T4', 'T6'), ('T6', 'O2'), ('Fp2', 'F4'), ('F4', 'C4'), ('C4', 'P4'), ('P4', 'O2')]

def butter_bandpass_filter(data, lowcut=0.5, highcut=40.0, fs=200, order=5):
    nyq = 0.5 * fs
    b, a = signal.butter(order, [lowcut / nyq, highcut / nyq], btype='band')
    return signal.filtfilt(b, a, data)

def get_time_stats(chain):
    return {
        'mean': np.mean(chain),
        'var': np.var(chain) + 1e-6,
        'max': np.max(chain),
        'min': np.min(chain),
        'zcr': len(np.where(np.diff(np.sign(chain)))[0]) / len(chain)
    }

def get_spectral_features(chain, fs=200):
    features = {}
    freqs, psd = signal.welch(chain, fs=fs, nperseg=400)
    bands = {'delta': (0.5, 4), 'theta': (4, 8), 'alpha': (8, 12), 'beta': (12, 30)}
    total_power = np.sum(psd) + 1e-6
    for band_name, (low, high) in bands.items():
        idx_band = np.logical_and(freqs >= low, freqs <= high)
        features[f'{band_name}_rel'] = np.sum(psd[idx_band]) / total_power
    return features

def get_evolution_features(chain):
    half_idx = len(chain) // 2
    first_half, second_half = chain[:half_idx], chain[half_idx:]
    
    var_first, var_second = np.var(first_half), np.var(second_half)
    power_evolution_ratio = (var_second + 1e-6) / (var_first + 1e-6)
    
    freqs1, psd1 = signal.welch(first_half, fs=200, nperseg=400)
    freqs2, psd2 = signal.welch(second_half, fs=200, nperseg=400)
    dom_freq1, dom_freq2 = freqs1[np.argmax(psd1)], freqs2[np.argmax(psd2)]
    
    return {
        'power_evolution_ratio': power_evolution_ratio,
        'freq_evolution_abs_diff': np.abs(dom_freq1 - dom_freq2)
    }

# --- NEW: PURE NUMPY COMPLEXITY FUNCTION ---
def get_complexity(chain, fs=200):
    # 1. Hjorth Parameters
    var_y = np.var(chain) + 1e-6
    
    diff1 = np.diff(chain)
    var_diff1 = np.var(diff1) + 1e-6
    mobility = np.sqrt(var_diff1 / var_y)
    
    diff2 = np.diff(diff1)
    var_diff2 = np.var(diff2) + 1e-6
    mobility_diff = np.sqrt(var_diff2 / var_diff1)
    complexity = mobility_diff / (mobility + 1e-6)
    
    # 2. Spectral Entropy
    freqs, psd = signal.welch(chain, fs=fs, nperseg=400)
    psd_norm = psd / (np.sum(psd) + 1e-6)
    psd_norm = psd_norm[psd_norm > 0] # Filter out zeros to avoid log(0) error
    spectral_entropy = -np.sum(psd_norm * np.log2(psd_norm))
    
    return {
        'hjorth_mobility': mobility,
        'hjorth_complexity': complexity,
        'spectral_entropy': spectral_entropy
    }

def get_spatial_features(chain_left, chain_right):
    corr = np.corrcoef(chain_left, chain_right)[0, 1]
    return {
        'asymmetry': np.abs(np.var(chain_left) - np.var(chain_right)),
        'cross_corr': corr if not np.isnan(corr) else 0
    }

def preprocess_uploaded_eeg(df):
    """
    Takes the raw Pandas DataFrame from the FastAPI upload, 
    creates the bipolar montages, and extracts all features.
    """
    eeg_slice = df.ffill().bfill().fillna(0)
    
    signals_dict = {}
    for p_l, p_r in zip(PAIRS_LEFT, PAIRS_RIGHT):
        name_l, name_r = f"{p_l[0]}-{p_l[1]}", f"{p_r[0]}-{p_r[1]}"
        if all(col in eeg_slice.columns for col in [p_l[0], p_l[1], p_r[0], p_r[1]]):
            signals_dict[name_l] = butter_bandpass_filter(eeg_slice[p_l[0]].values - eeg_slice[p_l[1]].values)
            signals_dict[name_r] = butter_bandpass_filter(eeg_slice[p_r[0]].values - eeg_slice[p_r[1]].values)
    
    row_features = {}
    for name, data in signals_dict.items():
        row_features.update({f"{name}_{k}": v for k, v in get_time_stats(data).items()})
        row_features.update({f"{name}_{k}": v for k, v in get_spectral_features(data).items()})
        row_features.update({f"{name}_{k}": v for k, v in get_complexity(data).items()})
        row_features.update({f"{name}_{k}": v for k, v in get_evolution_features(data).items()})
        row_features[f"{name}_deriv1_var"] = np.var(np.diff(data))
                
    for p_left, p_right in zip(PAIRS_LEFT, PAIRS_RIGHT):
        name_l, name_r = f"{p_left[0]}-{p_left[1]}", f"{p_right[0]}-{p_right[1]}"
        if name_l in signals_dict and name_r in signals_dict:
            spatial = get_spatial_features(signals_dict[name_l], signals_dict[name_r])
            row_features.update({f"{name_l}_vs_{name_r}_{k}": v for k, v in spatial.items()})
            
    return pd.DataFrame([row_features])