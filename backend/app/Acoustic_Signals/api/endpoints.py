from fastapi import APIRouter, UploadFile, File, HTTPException
from app.Acoustic_Signals.schemas.schema import GenerationInput, GeneratedSignal
from app.Acoustic_Signals.services.generate_signal import generate_signal
from app.Acoustic_Signals.services.extract_coef import extract_coef
from app.Acoustic_Signals.services.get_prediction import get_prediction

acoustic_router = APIRouter()

# 1 - Endpoint for generating doppler (Unchanged)
@acoustic_router.post("/doppler_generation")
def GenerateDoppler(Input: GenerationInput):
    # 1. We removed 'async' because math calculations block the server.
    #    Using plain 'def' runs it in a separate thread.
    result = generate_signal(
        Input.velocity,
        Input.frequency,
        Input.duration,
        Input.num_points_per_second
    )
    # 2. Return a dictionary {"signal": ...} so React can find it easily
    return {"signal": result}


# 2 - Endpoint for extracting velocity and frequency (Corrected)
@acoustic_router.post("/extract_coef")
def ExtractCoef(file: UploadFile = File(...)):
    """
    We use 'def' here (not async def) because extract_coef is a 
    CPU-heavy synchronous function. This prevents the TypeError.
    """
    return extract_coef(file)


# 3 - Endpoint for the AI models (Unchanged structure)
@acoustic_router.post("/submarine_detection")
async def GetPrediction(file: UploadFile = File(...)):
    """
    Kept as async def per instructions. 
    Removed 'await' if get_prediction returns a non-awaitable object.
    """
    return get_prediction(file)