from fastapi import APIRouter
from app.Acoustic_Signals.schemas.schema import GenerationInput, GeneratedSignal
from app.Acoustic_Signals.services.generate_signal import generate_signal
acoustic_router = APIRouter()



#

@acoustic_router.post("/doppler_generation")
async def GenerateDoppler(Input : GenerationInput ):
    input_dict = Input.dict()
    return generate_signal(input_dict.velocity,input_dict.frequency,input_dict.duration,input_dict.num_points_per_second)

