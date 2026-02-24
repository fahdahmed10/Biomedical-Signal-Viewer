from fastapi import APIRouter,File,UploadFile,HTTPException,status, Query
from app.EEG.schemas.schema import AnalysisResponse , PaginatedSignalResponse
from app.EEG.services.extract_info import FeatureExtractor
from app.EEG.services.predictions import AiPredictor
from io import BytesIO
import pandas as pd
import uuid
import json
import os
import shutil

EEG_Router = APIRouter()
extractor = FeatureExtractor()
predictor = AiPredictor()

TEMP_DIR = "temp_signal_data"
os.makedirs(TEMP_DIR, exist_ok=True)



@EEG_Router.post('/EEG', response_model=AnalysisResponse)
async def get_info(file: UploadFile = File(...)):

    if not (file.filename.endswith(".csv") or file.filename.endswith(".parquet")):
        raise HTTPException(status_code=406, detail="Only CSV or Parquet files allowed")

    # 1. Create a safe temporary file path
    temp_file_path = f"temp_{file.filename}"
    
    try:
        # 2. Save the massive file to disk INSTEAD of RAM
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 3. Let Pandas read it straight from the disk
        if file.filename.endswith(".csv"):
            df = pd.read_csv(temp_file_path)
        else:
            df = pd.read_parquet(temp_file_path)

    except Exception as e:
        print("ERROR PARSING:", e)
        raise HTTPException(status_code=400, detail="Could not parse file")
    
    finally:
        # 4. ALWAYS delete the temp file so your hard drive doesn't fill up
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
        
    # Proceed with your logic...
    metadata, time_array, signals_dict = extractor.extract(df)
    predictions = predictor.predict(df)
    
    file_id = str(uuid.uuid4())
    filepath = os.path.join(TEMP_DIR, f"{file_id}.json")
    
    
    with open(filepath, "w") as f:
        json.dump({"time": time_array, "signals": signals_dict}, f)
        
        
    return {
        "file_id": file_id,
        "features": metadata,
        "predictions": predictions
    }
    
@EEG_Router.get('/EEG/data/{file_id}', response_model=PaginatedSignalResponse)
async def get_eeg_data(
    file_id: str, 
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(1000, ge=1, le=5000, description="Data points per page")
):
    filepath = os.path.join(TEMP_DIR, f"{file_id}.json")
    
    # Check if the file exists
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Data file not found. You must analyze a file first.")

    # Load the massive data from the disk
    with open(filepath, "r") as f:
        data = json.load(f)

    # Calculate start and end indices for pagination
    start_index = (page - 1) * limit
    end_index = start_index + limit
    total_samples = len(data["time"])

    # Slice the arrays to return only the requested chunk
    chunk_time = data["time"][start_index:end_index]
    chunk_signals = {ch: vals[start_index:end_index] for ch, vals in data["signals"].items()}

    return {
        "time": chunk_time,
        "signals": chunk_signals,
        "total_samples": total_samples
    }