import pandas as pd
import numpy as np
import mne
import wfdb
import os
import shutil
import zipfile
import rarfile  # Added for RAR support
from fastapi import UploadFile, HTTPException
from app.schemas.signal_models import SignalResponse, ChannelData
from app.services.time_generator import generate_time_axis, detect_sampling_rate
from app.services.resampler import resample_signal

async def parse_signal_file(file: UploadFile) -> SignalResponse:
    filename = file.filename.lower()
    temp_dir = "temp_uploads"
    os.makedirs(temp_dir, exist_ok=True)
    
    channels = []
    sampling_rate = 100.0
    time_axis = []
    
    try:
        # --- 1. CSV / TXT Dynamic Detection ---
        if filename.endswith(('.csv', '.txt')):
            df = pd.read_csv(file.file, sep=None, engine='python')
            df = df.select_dtypes(include=[np.number])
            
            time_cols = [c for c in df.columns if 'time' in c.lower() or 'sec' in c.lower()]
            if time_cols:
                raw_time = df[time_cols[0]].tolist()
                sampling_rate = detect_sampling_rate(raw_time)
                time_axis = resample_signal(raw_time, 10000)
                df = df.drop(columns=time_cols)
            
            for col_name in df.columns:
                raw_data = df[col_name].fillna(0).tolist()
                optimized_data = resample_signal(raw_data, 10000)
                channels.append(ChannelData(name=col_name, values=optimized_data))

        # --- 2. EDF / BDF Dynamic Detection ---
        elif filename.endswith(('.edf', '.bdf')):
            temp_path = os.path.join(temp_dir, filename)
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
                
            raw = mne.io.read_raw_edf(temp_path, preload=True, verbose=False)
            sampling_rate = raw.info['sfreq']
            df = raw.to_data_frame()
            
            if 'time' in df.columns:
                df = df.drop(columns=['time'])
                
            for col_name in df.columns:
                raw_data = df[col_name].tolist()
                optimized_data = resample_signal(raw_data, 10000)
                channels.append(ChannelData(name=col_name, values=optimized_data))

        # --- 3. WFDB (Zip / Rar) Dynamic Detection ---
        elif filename.endswith(('.zip', '.rar')):
            archive_path = os.path.join(temp_dir, filename)
            
            # Safely write the uploaded archive to disk
            with open(archive_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            extract_path = os.path.join(temp_dir, "extracted")
            
            # Extract the contents based on file extension
            try:
                if filename.endswith('.zip'):
                    with zipfile.ZipFile(archive_path, 'r') as z:
                        z.extractall(extract_path)
                elif filename.endswith('.rar'):
                    # Note: On Windows, rarfile might require the 'unrar' tool installed and in PATH
                    with rarfile.RarFile(archive_path, 'r') as r:
                        r.extractall(extract_path)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to extract archive: {str(e)}")
            
            # Smart Search for the .hea file (ignoring hidden Mac files)
            header_file_path = None
            for root, dirs, files in os.walk(extract_path):
                dirs[:] = [d for d in dirs if not d.startswith('.')] 
                for extracted_file in files:
                    if extracted_file.endswith('.hea') and not extracted_file.startswith('.'):
                        header_file_path = os.path.join(root, extracted_file)
                        break
                if header_file_path:
                    break
            
            if not header_file_path:
                raise HTTPException(status_code=400, detail="Could not find a valid .hea file inside the archive.")
            
            # Verify the .dat file is actually sitting next to it
            record_dir = os.path.dirname(header_file_path)
            record_base_name = os.path.splitext(os.path.basename(header_file_path))[0]
            expected_dat_path = os.path.join(record_dir, f"{record_base_name}.dat")
            
            if not os.path.exists(expected_dat_path):
                 raise HTTPException(
                     status_code=400, 
                     detail=f"Found {record_base_name}.hea, but its required partner {record_base_name}.dat is missing from the same folder."
                 )

            # Read the record using wfdb
            record_path = os.path.splitext(header_file_path)[0]
            try:
                record = wfdb.rdrecord(record_path)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"wfdb library failed to read the files: {str(e)}")
            
            sampling_rate = record.fs
            
            # Loop through the signals
            for i, sig_name in enumerate(record.sig_name):
                # Ensure data is converted to standard float lists for JSON (handles NaNs safely)
                raw_data = np.nan_to_num(record.p_signal[:, i]).tolist() 
                optimized_data = resample_signal(raw_data, 10000)
                channels.append(ChannelData(name=sig_name, values=optimized_data))

        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV, TXT, EDF, BDF, ZIP, or RAR.")

        if not channels:
             raise HTTPException(status_code=400, detail="No signal data found in the file.")

        # --- Final Data Assembly ---
        final_samples = len(channels[0].values)
        number_of_channels = len(channels)

        if not time_axis:
            duration_approx = final_samples / (sampling_rate if sampling_rate else 100)
            time_axis = np.linspace(0, duration_approx, final_samples).tolist()

        return SignalResponse(
            filename=file.filename,
            sampling_rate=sampling_rate,
            duration=time_axis[-1] if time_axis else 0,
            total_samples=final_samples,
            n_channels=number_of_channels,
            time_axis=time_axis,
            channels=channels
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)