import numpy as np
import cv2
import torch
import librosa
from torchvision import transforms

# We need the same chains you used in ML to generate the 4 regions
FEATS = ['Fp1','F3','C3','P3','F7','T3','T5','O1','Fz','Cz','Pz','Fp2','F4','C4','P4','F8','T4','T6','O2','EKG']
FEAT2IDX = {x:y for x,y in zip(FEATS, range(len(FEATS)))}

def create_spectrogram_from_eeg(eeg_df):
    """Reconstructs the Kaggle-style 4-region spectrogram from raw EEG"""
    # 1. Take the middle 10 seconds (2000 rows at 200Hz) to match Kaggle's focus
    total_len = len(eeg_df)
    if total_len > 2000:
        start = (total_len // 2) - 1000
        eeg_slice = eeg_df.iloc[start:start+2000].values
    else:
        eeg_slice = eeg_df.values

    # 2. Create the 4 Brain Regions (LL, RL, LP, RP)
    chains = []
    # Left Lateral (LL)
    chains.append(np.mean([eeg_slice[:, FEAT2IDX['Fp1']] - eeg_slice[:, FEAT2IDX['F7']],
                           eeg_slice[:, FEAT2IDX['F7']] - eeg_slice[:, FEAT2IDX['T3']],
                           eeg_slice[:, FEAT2IDX['T3']] - eeg_slice[:, FEAT2IDX['T5']],
                           eeg_slice[:, FEAT2IDX['T5']] - eeg_slice[:, FEAT2IDX['O1']]], axis=0))
    # Right Lateral (RL)
    chains.append(np.mean([eeg_slice[:, FEAT2IDX['Fp2']] - eeg_slice[:, FEAT2IDX['F8']],
                           eeg_slice[:, FEAT2IDX['F8']] - eeg_slice[:, FEAT2IDX['T4']],
                           eeg_slice[:, FEAT2IDX['T4']] - eeg_slice[:, FEAT2IDX['T6']],
                           eeg_slice[:, FEAT2IDX['T6']] - eeg_slice[:, FEAT2IDX['O2']]], axis=0))
    # Left Parasagittal (LP)
    chains.append(np.mean([eeg_slice[:, FEAT2IDX['Fp1']] - eeg_slice[:, FEAT2IDX['F3']],
                           eeg_slice[:, FEAT2IDX['F3']] - eeg_slice[:, FEAT2IDX['C3']],
                           eeg_slice[:, FEAT2IDX['C3']] - eeg_slice[:, FEAT2IDX['P3']],
                           eeg_slice[:, FEAT2IDX['P3']] - eeg_slice[:, FEAT2IDX['O1']]], axis=0))
    # Right Parasagittal (RP)
    chains.append(np.mean([eeg_slice[:, FEAT2IDX['Fp2']] - eeg_slice[:, FEAT2IDX['F4']],
                           eeg_slice[:, FEAT2IDX['F4']] - eeg_slice[:, FEAT2IDX['C4']],
                           eeg_slice[:, FEAT2IDX['C4']] - eeg_slice[:, FEAT2IDX['P4']],
                           eeg_slice[:, FEAT2IDX['P4']] - eeg_slice[:, FEAT2IDX['O2']]], axis=0))

    # 3. Generate Spectrograms and stack them horizontally 
    # (This mimics Kaggle's 400 frequency bins = 4 regions * 100 bins)
    img = np.zeros((100, 300, 4), dtype=np.float32)
    
    for i, chain in enumerate(chains):
        # Generate spectrogram matching Kaggle frequencies
        mel_spec = librosa.feature.melspectrogram(y=chain, sr=200, hop_length=len(chain)//300, 
                                                  n_fft=1024, n_mels=100, fmin=0, fmax=20)
        # Pad or truncate width to exactly 300
        width = mel_spec.shape[1]
        if width < 300:
            mel_spec = np.pad(mel_spec, ((0,0), (0, 300-width)), mode='constant')
        else:
            mel_spec = mel_spec[:, :300]
            
        img[:, :, i] = mel_spec

    # Reshape from (100, 300, 4) to (400, 300)
    img = img.reshape(400, 300, order='F')
    return img

def preprocess_eeg_for_dl(df):
    """Takes DataFrame, returns PyTorch Tensor for EfficientNet"""
    # 1. Reconstruct Kaggle format
    spec_array = create_spectrogram_from_eeg(df)
    
    # 2. Apply EXACT transformations from your training script
    temp_df = np.log1p(spec_array)
    max_val = temp_df.max()
    if max_val > 0:
        temp_df /= max_val
    temp_arr = np.nan_to_num(temp_df, nan=1e-4)
    
    # 3. Jet Colormap
    temp_arr_uint8 = np.uint8(255 * temp_arr)
    img_colored = cv2.applyColorMap(temp_arr_uint8, cv2.COLORMAP_JET)
    
    # 4. Convert to Tensor
    img_float = img_colored.astype(np.float32) / 255.0
    img_tensor = torch.tensor(img_float).permute(2, 0, 1) # (C, H, W)
    
    # 5. Resize to 224x224
    resize_transform = transforms.Resize((224, 224), antialias=True)
    X_tensor = resize_transform(img_tensor).unsqueeze(0) # (1, 3, 224, 224)
    
    return X_tensor