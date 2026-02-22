import pandas as pd
import io
import numpy as np 
import torch
import torch.nn as nn
from transformers import AutoModel
from pathlib import Path


# ECG CSV PARSER  

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

    signals = {
        ch: df[ch].astype(float).tolist()
        for ch in channels
    }

    duration = float(time[-1]) if time else None

    return {
        "num_channels": len(channels),
        "channels": channels,
        "num_samples": len(df),
        "duration": duration,
        "time": time,
        "signals": signals
    }


#LOAD AI MODEL
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


checkpoint = torch.load(MODEL_PATH, map_location="cpu")

base_model = AutoModel.from_pretrained(
    checkpoint["model_name"],
    trust_remote_code=True
)

ai_model = ECGMultiLabelModel(
    base_model,
    checkpoint["num_labels"]
)

ai_model.load_state_dict(checkpoint["model_state_dict"])
ai_model.eval()

print("ECG AI Model Loaded")


# AI FEATURE (Predict فقط)
async def predict_ecg(parsed_data):
    channels = parsed_data["channels"]
    
    # بناء مصفوفة الإشارات من parsed_data
    # شكل signal_np سيكون [num_samples, num_channels]
    signal_np = np.array([parsed_data["signals"][ch] for ch in channels]).T
    
    # تحويل إلى tensor
    signal_tensor = torch.tensor(
        signal_np,
        dtype=torch.float32
    )
    
    # قص الطول إذا كان أطول من MAX_LEN
    MAX_LEN = 5000
    if signal_tensor.shape[0] > MAX_LEN:
        signal_tensor = signal_tensor[:MAX_LEN, :]
    
    # تحويل من [seq_len, channels] إلى [channels, seq_len] كما في الـ notebook
    signal_tensor = signal_tensor.transpose(0, 1)  # [channels, seq_len]
    
    print(f"Tensor shape before model: {signal_tensor.shape}")  # للتأكد
    
    with torch.no_grad():
        # الموديل يتوقع [channels, seq_len] مباشرة
        features = ai_model.base(signal_tensor, sampling_rate=360).last_hidden_state
        pooled = features.mean(dim=1)
        preds = ai_model.classifier(pooled)
    
    # استخراج التنبؤات
    if preds.dim() == 2:
        preds = preds[0]
    
    preds_list = preds.cpu().numpy().tolist()

    class_map = {
        0: "Normal",
        1: "AFib",
        2: "PVC",
        3: "LBBB",
        4: "RBBB"
    }

    # طبقة التنبؤات للتصحيح
    print(f"Predictions: {dict(zip(class_map.values(), preds_list))}")

    return {
        "prediction": {
            class_map[i]: float(preds_list[i])
            for i in range(len(preds_list))
        }
    }