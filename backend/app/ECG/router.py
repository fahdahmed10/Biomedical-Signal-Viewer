from fastapi import APIRouter, UploadFile, File
from app.ECG.service import parse_ecg
from app.ECG.schema import ECGResponse

router = APIRouter()

@router.post("/upload", response_model=ECGResponse)
async def upload_ecg(file: UploadFile = File(...)):

    result = await parse_ecg(file)

    return result
