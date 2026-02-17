import numpy as np
import librosa as lb
import scipy.signal as signal
from fastapi import UploadFile, File, HTTPException, status
from app.Acoustic_Signals.schemas.schema import Coef
from scipy.ndimage import median_filter

def extract_coef(file: UploadFile = File(...)):
    c = 343  # speed of sound (m/s)

    file_name = file.filename
    if not (file_name.endswith(".mp3") or file_name.endswith(".wav")):
        raise HTTPException(status_code=status.HTTP_406_NOT_ACCEPTABLE)

    file.file.seek(0)
    sig_arr, sr = lb.load(file.file, sr=None, mono=True)

    # STFT
    f, t, Zxx = signal.stft(sig_arr, fs=sr, nperseg=2048)
    magn = np.abs(Zxx)

    # Restrict to car engine frequency band
    band_mask = (f > 100) & (f < 1000)
    f = f[band_mask]
    magn = magn[band_mask, :]

    # Dominant frequency per frame
    dominant_freq = f[np.argmax(magn, axis=0)]

    # Frame RMS energy
    frame_energy = np.sqrt(np.mean(magn**2, axis=0))
    peak_index = np.argmax(frame_energy)

    if peak_index == 0 or peak_index == len(dominant_freq) - 1:
        return Coef(velocity=0.0, frequency=0.0, signal=sig_arr.tolist()[::20])

    # Average dominant frequency around the peak
    window_size = 10
    f_approach = np.mean(dominant_freq[max(0, peak_index - window_size):peak_index])
    f_recede = np.mean(dominant_freq[peak_index:min(len(dominant_freq), peak_index + window_size)])

    # Compute velocity (absolute value to avoid negative due to direction)
    if (f_approach + f_recede) == 0:
        v = 0.0
        f_source = 0.0
    else:
        v = abs(c * (f_approach - f_recede) / (f_approach + f_recede))
        f_source = f_approach * (c - v) / c

    # Sanity check
    if v > c:
        v = 0.0

    return Coef(
        velocity=float(v)*3.6,
        frequency=float(f_source),
        signal=sig_arr.tolist()[::20]
    )
