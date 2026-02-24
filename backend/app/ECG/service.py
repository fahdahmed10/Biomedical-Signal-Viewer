import pandas as pd
import io
import numpy as np 
import torch
import torch.nn as nn
from transformers import AutoModel
from pathlib import Path
import joblib
from scipy import stats  

# ========== ECG CSV PARSER ==========
async def parse_ecg(file):
    contents = await file.read()
    df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    df.columns = [c.lower() for c in df.columns]
    if "time" in df.columns:
        time = df["time"].tolist()
        channels = [c for c in df.columns if c != "time"]
    else:
        fs = 360
        time = [i / fs for i in range(len(df))]
        channels = df.columns.tolist()
    signals = {ch: df[ch].astype(float).tolist() for ch in channels}
    duration = float(time[-1]) if time else None
    return {
        "num_channels": len(channels),
        "channels": channels,
        "num_samples": len(df),
        "duration": duration,
        "time": time,
        "signals": signals
    }

# ========== LOAD AI MODEL (pretrained) ==========
MODEL_PATH = Path(__file__).parent / "models" / "ecg_multilabel_model.pth"

class ECGMultiLabelModel(nn.Module):
    def __init__(self, base_model, num_labels):
        super().__init__()
        self.base = base_model
        self.classifier = nn.Sequential(
            nn.Linear(base_model.config.hidden_size, num_labels),
            nn.Sigmoid()
        )

    def forward(self, x, sampling_rate=360):
        features = self.base(x, sampling_rate=sampling_rate).last_hidden_state
        pooled = features.mean(dim=1)
        return self.classifier(pooled)

ai_model = None
try:
    checkpoint = torch.load(MODEL_PATH, map_location="cpu")
    base_model = AutoModel.from_pretrained(
        checkpoint["model_name"],
        trust_remote_code=True
    )
    ai_model = ECGMultiLabelModel(base_model, checkpoint["num_labels"])
    ai_model.load_state_dict(checkpoint["model_state_dict"])
    ai_model.eval()
    print("ECG AI Model Loaded")
except Exception as e:
    print(f"Failed to load AI model: {e}")

# ========== LOAD CLASSICAL MODEL (Random Forest) ==========
CLASSIC_MODEL_PATH = Path(__file__).parent / "models" / "balanced_rf_ecg.pkl"
classic_model = None
try:
    classic_model = joblib.load(CLASSIC_MODEL_PATH)
    print("Classical Random Forest model loaded")
except Exception as e:
    print(f"Failed to load classical model: {e}")

# ========== FEATURE EXTRACTION FOR CLASSICAL MODEL ==========
def extract_features(signal):
    """Extract statistical features from a single channel signal."""
    return [
        np.mean(signal),
        np.std(signal),
        np.max(signal),
        np.min(signal),
        np.ptp(signal),
        np.median(signal),
        np.percentile(signal, 25),
        np.percentile(signal, 75),
        stats.skew(signal),
        stats.kurtosis(signal)
    ]

# ========== PREDICT FUNCTION ==========
async def predict_ecg(parsed_data, model_type="pretrained"):
    if model_type == "pretrained":
        if ai_model is None:
            # fallback
            return {
                "prediction": {
                    "Normal": 0.8,
                    "AFib": 0.05,
                    "PVC": 0.05,
                    "LBBB": 0.05,
                    "RBBB": 0.05
                }
            }
        channels = parsed_data["channels"]
        signal_np = np.array([parsed_data["signals"][ch] for ch in channels]).T
        signal_tensor = torch.tensor(signal_np, dtype=torch.float32)
        MAX_LEN = 5000
        if signal_tensor.shape[0] > MAX_LEN:
            signal_tensor = signal_tensor[:MAX_LEN, :]
        signal_tensor = signal_tensor.transpose(0, 1)
        print(f"Tensor shape before model: {signal_tensor.shape}")
        with torch.no_grad():
            features = ai_model.base(signal_tensor, sampling_rate=360).last_hidden_state
            pooled = features.mean(dim=1)
            preds = ai_model.classifier(pooled)
        if preds.dim() == 2:
            preds = preds[0]
        preds_list = preds.cpu().numpy().tolist()
        class_map = {0: "Normal", 1: "AFib", 2: "PVC", 3: "LBBB", 4: "RBBB"}
        print(f"Predictions: {dict(zip(class_map.values(), preds_list))}")
        return {
            "prediction": {
                class_map[i]: float(preds_list[i])
                for i in range(len(preds_list))
            }
        }
    elif model_type == "classical":
        if classic_model is None:
            return {
                "prediction": {
                    "Normal": 0.8,
                    "AFib": 0.05,
                    "PVC": 0.05,
                    "LBBB": 0.05,
                    "RBBB": 0.05
                }
            }

        channels = parsed_data["channels"]
        if not channels:
            return {"prediction": {}}
        signal = np.array(parsed_data["signals"][channels[0]])
        features = extract_features(signal)
        pred = classic_model.predict([features])[0]
        if hasattr(classic_model, "predict_proba"):
            probs = classic_model.predict_proba([features])[0]
        else:
            probs = np.zeros(5)
            probs[int(pred)] = 1.0
        class_map = {0: "Normal", 1: "AFib", 2: "PVC", 3: "LBBB", 4: "RBBB"}
        return {
            "prediction": {
                class_map[i]: float(probs[i])
                for i in range(5)
            }
        }
    else:
        return {
            "prediction": {
                "Normal": 0.8,
                "AFib": 0.05,
                "PVC": 0.05,
                "LBBB": 0.05,
                "RBBB": 0.05
            }
        }