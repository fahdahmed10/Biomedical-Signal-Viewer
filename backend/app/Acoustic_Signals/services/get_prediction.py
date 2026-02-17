from fastapi import UploadFile, File, HTTPException, status
from app.Acoustic_Signals.schemas.schema import AiPrediction
import onnxruntime as ort
import joblib
import librosa
import numpy as np
import os
import warnings

warnings.filterwarnings("ignore")

class UnifiedSubmarineDetector:
    def __init__(self):
        # Determine paths relative to this file
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        onnx_path = os.path.join(base_path, 'notebook', 'submarine_model.onnx')
        ml_path = os.path.join(base_path, 'notebook', 'submarine_rf_model.pkl')
        
        # 1. Load ONNX Session
        self.ort_session = ort.InferenceSession(onnx_path)
        
        # 2. Load Machine Learning Model
        self.ml_model = joblib.load(ml_path)
        print("✅ Ensemble (ONNX + ML) ready.")

    def _extract_ml_features(self, y, sr):
        mfcc = np.mean(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13).T, axis=0)
        centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr).T, axis=0)
        zcr = np.mean(librosa.feature.zero_crossing_rate(y).T, axis=0)
        rolloff = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr).T, axis=0)
        return np.hstack([mfcc, centroid, zcr, rolloff])

    def _extract_dl_spectrogram(self, y, sr):
        spec = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128)
        spec_db = librosa.power_to_db(spec, ref=np.max)
        spec_db = (spec_db - spec_db.min()) / (spec_db.max() - spec_db.min() + 1e-6)
        # Reshape to (Batch, Channel, Height, Width) for ONNX
        return spec_db.astype(np.float32)[np.newaxis, np.newaxis, :, :]

    def predict(self, audio_file):
        # 1. Load audio
        signal, sr = librosa.load(audio_file, sr=16000)
        
        # Ensure 4s duration
        max_len = 16000 * 4
        y = np.pad(signal, (0, max_len - len(signal))) if len(signal) < max_len else signal[:max_len]

        # 2. DL Prediction (ONNX)
        input_name = self.ort_session.get_inputs()[0].name
        ort_outs = self.ort_session.run(None, {input_name: self._extract_dl_spectrogram(y, sr)})
        logits = ort_outs[0][0][0]
        dl_prob = 1 / (1 + np.exp(-logits)) # Sigmoid

        # 3. ML Prediction (Random Forest)
        ml_prob = self.ml_model.predict_proba([self._extract_ml_features(y, sr)])[0][1]

        # 4. Ensemble
        avg_prob = (dl_prob + ml_prob) / 2
        label = "🚨 SUBMARINE" if avg_prob > 0.5 else "✅ NO SUBMARINE"
        
        return signal, ml_prob, dl_prob, avg_prob, label

def get_prediction(file: UploadFile = File(...)):
    if not (file.filename.endswith(".mp3") or file.filename.endswith(".wav")):
        raise HTTPException(status_code=status.HTTP_406_NOT_ACCEPTABLE)

    detector = UnifiedSubmarineDetector()
    signal, ml_p, dl_p, avg_p, label = detector.predict(file.file)
    
    return AiPrediction(
        signal=signal.tolist()[::10],              
        ml_prediction=round(float(ml_p) * 100, 2), 
        dl_prediction=round(float(dl_p) * 100, 2),
        mixed_approach=round(float(avg_p) * 100, 2),
        label =  label
    )