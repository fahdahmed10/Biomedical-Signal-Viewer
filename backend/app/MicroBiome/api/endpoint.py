from fastapi import FastAPI, APIRouter, UploadFile, File
from app.MicroBiome.services.profiling import GetProfile



microbiome_rouuter = APIRouter()


@microbiome_rouuter.post('/microbiome')
async def analyze(file : UploadFile = File(...)):
    return await GetProfile(file)