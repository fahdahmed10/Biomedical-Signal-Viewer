from fastapi import APIRouter, UploadFile, File
from app.ECG.service import parse_ecg, predict_ecg
from app.ECG.schema import ECGResponse
from app.ECG.schema import PredictionResponse

router = APIRouter()

@router.post("/upload", response_model=ECGResponse)
async def upload_ecg(file: UploadFile = File(...)):

    return await parse_ecg(file)

@router.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    data = await parse_ecg(file)  
    preds = await predict_ecg(data)  
    return preds  