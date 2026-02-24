import xgboost as xgb
import numpy as np
import os
import torch
import torch.nn.functional as F
from torchvision.models import efficientnet_v2_s

from app.EEG.services.ml_feature_logic import preprocess_uploaded_eeg
from app.EEG.services.dl_feature_logic import preprocess_eeg_for_dl

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ML_MODEL_DIR = os.path.join(CURRENT_DIR, "..", "models", "ml")

# 1. FIX THE DL MODEL FILENAME HERE:
DL_MODEL_PATH = os.path.join(CURRENT_DIR, "..", "models", "dl", "EfficientNetV2_S_Spect_Model_FromScratch_v1 (2).pth")

class AiPredictor:
    def __init__(self):
        self.classes = ["Seizure", "LPD", "GPD", "LRDA", "GRDA", "Other"]
        
        # --- 1. LOAD ML MODELS (XGBoost) ---
        self.ml_models = []
        try:
            for i in range(5):
                # 2. FIX THE ML MODEL FILENAME HERE:
                path = os.path.join(ML_MODEL_DIR, f"xgb_model_foldFinal_{i}.json")
                if os.path.exists(path):
                    model = xgb.XGBRegressor()
                    model.load_model(path)
                    self.ml_models.append(model)
            print(f" Loaded {len(self.ml_models)} ML models.")
        except Exception as e:
            print(f" Error loading ML models: {e}")

        # --- 2. LOAD DL MODEL 
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.dl_model = None
        

        self.dl_training_classes = ['Seizure', 'GPD', 'LRDA', 'Other', 'GRDA', 'LPD']
        
        try:
            if os.path.exists(DL_MODEL_PATH):
                self.dl_model = efficientnet_v2_s(weights=None)
             
                self.dl_model.classifier[1] = torch.nn.Linear(self.dl_model.classifier[1].in_features, 6)
                

                state_dict = torch.load(DL_MODEL_PATH, map_location=self.device)
                self.dl_model.load_state_dict(state_dict, strict=False)
                
                self.dl_model.to(self.device)
                self.dl_model.eval() 
                print(f" Loaded PyTorch DL model on {self.device}.")
            else:
                print("⚠️ DL model file not found.")
        except Exception as e:
            print(f" Error loading DL model: {e}")

    def predict(self, df):
        ml_results = {c: 0.0 for c in self.classes}
        dl_results = {c: 0.0 for c in self.classes}

        # --- ML PREDICTION ---
        if self.ml_models:
            try:
                ml_input = preprocess_uploaded_eeg(df)
                ml_preds = np.zeros((1, 6))
                for model in self.ml_models:
                    for model in self.ml_models:
                    # Adding .values prevents feature_name mismatch errors
                        pred = model.predict(ml_input.values) 
                        pred = np.clip(pred, 1e-15, 1.0)
                    pred = pred / np.sum(pred, axis=1, keepdims=True)
                    ml_preds += pred
                
                ml_final = ml_preds / len(self.ml_models)
                ml_results = dict(zip(self.classes, np.round(ml_final[0], 4).tolist()))
            except Exception as e:
                print(f"⚠️ ML Prediction failed: {e}")

        # --- DL PREDICTION ---
        if self.dl_model:
            try:
                tensor_input = preprocess_eeg_for_dl(df)
                tensor_input = tensor_input.to(self.device)

                with torch.no_grad():
                    logits = self.dl_model(tensor_input)
                    probabilities = F.softmax(logits, dim=1).cpu().numpy()[0]

                raw_dl_dict = dict(zip(self.dl_training_classes, probabilities))

                dl_results = {
                    "Seizure": round(float(raw_dl_dict["Seizure"]), 4),
                    "LPD": round(float(raw_dl_dict["LPD"]), 4),
                    "GPD": round(float(raw_dl_dict["GPD"]), 4),
                    "LRDA": round(float(raw_dl_dict["LRDA"]), 4),
                    "GRDA": round(float(raw_dl_dict["GRDA"]), 4),
                    "Other": round(float(raw_dl_dict["Other"]), 4),
                }
            except Exception as e:
                print(f"⚠️ DL Prediction failed: {e}")

        return {
            "ML_Predictions": ml_results,
            "DL_Predictions": dl_results
        }