import wfdb
import pandas as pd
import numpy as np
import os

#2 channels: MLII, V5

record_name = '100'         
save_folder = 'Data'       
file_name = f'record_{record_name}.csv'


os.makedirs(save_folder, exist_ok=True)


record = wfdb.rdrecord(record_name, pn_dir='mitdb')

signal = record.p_signal
fs = record.fs
channels = record.sig_name


time = np.arange(signal.shape[0]) / fs


df = pd.DataFrame(signal, columns=channels)
df.insert(0, 'time', time)


save_path = os.path.join(save_folder, file_name)
df.to_csv(save_path, index=False)

print("Saved successfully at:")
print(save_path)
print("Sampling Frequency:", fs)
print("Channels:", channels)
