import wfdb
import pandas as pd


record = wfdb.rdrecord(
    r"C:\Users\menna\Downloads\Biomedical-Signal-Viewer\Data\100"
)

signals = record.p_signal
channels = record.sig_name

# sampling rate
fs = record.fs

# time axis
time = [i / fs for i in range(len(signals))]

# DataFrame
df = pd.DataFrame(signals, columns=channels)
df.insert(0, "time", time)


df.to_csv("ecg.csv", index=False)
print("CSV created!")
