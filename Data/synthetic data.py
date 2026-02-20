import numpy as np
import pandas as pd


num_samples = 500  
num_channels = 3  
fs = 250          
t = np.arange(num_samples) / fs  


data = {}
data['time'] = t
for i, ch in enumerate(['MLII', 'V1', 'V2']):
    
    data[ch] = 0.5 * np.sin(2 * np.pi * 1.0 * t + i) + 0.05 * np.random.randn(num_samples)


df = pd.DataFrame(data)
df.to_csv('synthetic_ecg.csv', index=False)

print("CSV file generated successfully!")
