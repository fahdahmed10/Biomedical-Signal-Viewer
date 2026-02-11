from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.file_parser import parse_signal_file
from app.services.signal_math import calculate_derived
from app.schemas.signal_models import SignalResponse, DerivedSignalRequest, ChannelData

router = APIRouter()

@router.post("/upload", response_model=SignalResponse)
async def upload_signal(file: UploadFile = File(...)):
    """Receives file, parses it dynamically, and returns JSON signal data."""
    return await parse_signal_file(file)

@router.post("/process/derive", response_model=ChannelData)
async def derive_signal(request: DerivedSignalRequest):
    """Calculates a new derived signal from two inputs."""
    new_values = calculate_derived(
        request.channel_1,
        request.channel_2,
        request.operation,
        request.weights
    )
    return ChannelData(name=f"Derived ({request.operation})", values=new_values)