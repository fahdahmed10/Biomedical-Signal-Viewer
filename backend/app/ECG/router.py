from fastapi import APIRouter, UploadFile, File, Form
from app.ECG.service import parse_ecg, predict_ecg
from app.ECG.schema import ECGResponse, PredictionResponse

router = APIRouter()

@router.post("/upload", response_model=ECGResponse)
async def upload_ecg(file: UploadFile = File(...)):
    return await parse_ecg(file)

@router.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...), model: str = Form(...)):
    data = await parse_ecg(file)
    preds = await predict_ecg(data, model_type=model)
    return preds