import os
import zipfile
import pandas as pd
import numpy as np
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox
import struct

def select_zip_file():
    """Open dialog to select ZIP file"""
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    
    file_path = filedialog.askopenfilename(
        title="Select ZIP file",
        filetypes=[("ZIP files", "*.zip"), ("All files", "*.*")]
    )
    
    root.destroy()
    return file_path

def select_output_folder():
    """Open dialog to select output folder"""
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    
    folder_path = filedialog.askdirectory(
        title="Select folder to save CSV file"
    )
    
    root.destroy()
    return folder_path

def read_hea_file(hea_path):
    """Read HEA file and extract information"""
    info = {
        'record_name': '',
        'num_signals': 0,
        'sampling_rate': 0,
        'num_samples': 0,
        'signals': []
    }
    
    with open(hea_path, 'r') as f:
        lines = f.readlines()
    
    # First line
    first_line = lines[0].strip().split()
    info['record_name'] = first_line[0]
    info['num_signals'] = int(first_line[1])
    info['sampling_rate'] = int(first_line[2])
    info['num_samples'] = int(first_line[3])
    
    # Remaining lines (channel information)
    for i in range(1, len(lines)):
        if lines[i].strip():
            parts = lines[i].strip().split()
            signal_info = {
                'file_name': parts[0],
                'format': parts[1],
                'gain': parts[2],
                'units': parts[3] if len(parts) > 3 else '',
                'adc_zero': int(parts[4]) if len(parts) > 4 else 0,
                'first_value': int(parts[5]) if len(parts) > 5 else 0,
            }
            info['signals'].append(signal_info)
    
    return info

def read_dat_file(dat_path, num_samples, num_signals, format_spec='16'):
    """Read DAT file and extract data"""
    data = []
    
    with open(dat_path, 'rb') as f:
        if format_spec == '16' or format_spec.startswith('16'):
            # 16-bit integers
            raw_data = f.read()
            for i in range(0, len(raw_data), 2):
                if i + 1 < len(raw_data):
                    val = struct.unpack('<h', raw_data[i:i+2])[0]
                    data.append(val)
    
    # Reshape data according to number of channels
    if len(data) >= num_samples * num_signals:
        shaped = []
        for i in range(num_samples):
            row = [i + 1]  # sample number
            for j in range(num_signals):
                idx = i * num_signals + j
                if idx < len(data):
                    row.append(data[idx])
            shaped.append(row)
        
        return shaped
    
    return None

def convert_zip_to_csv(zip_path, output_folder):
    """Convert ZIP file to a single CSV file"""
    try:
        print(f"\nOpening ZIP file: {zip_path}")
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Extract all files to temp folder
            extract_path = Path(output_folder) / "temp_extract"
            zip_ref.extractall(extract_path)
            
            # Find HEA file
            hea_files = list(extract_path.rglob("*.hea")) + list(extract_path.rglob("*.HEA"))
            if not hea_files:
                print("No HEA file found in ZIP")
                return None
            
            hea_path = hea_files[0]
            print(f"Reading HEA file: {hea_path.name}")
            
            # Read HEA information
            info = read_hea_file(hea_path)
            
            # Find DAT file
            dat_files = list(extract_path.rglob("*.dat")) + list(extract_path.rglob("*.DAT"))
            if not dat_files:
                print("No DAT file found in ZIP")
                return None
            
            dat_path = dat_files[0]
            print(f"   Reading DAT file: {dat_path.name}")
            print(f"   Channels: {info['num_signals']}")
            print(f"   Sampling rate: {info['sampling_rate']} Hz")
            print(f"   Samples: {info['num_samples']}")
            
            # Read data
            format_spec = info['signals'][0]['format'].split('+')[0] if info['signals'] else '16'
            data = read_dat_file(dat_path, info['num_samples'], info['num_signals'], format_spec)
            
            if not data:
                print("Failed to read data")
                return None
            
            # Create column names: CHANNEL_1, CHANNEL_2, etc.
            columns = ['sample']
            for i in range(info['num_signals']):
                columns.append(f'CHANNEL_{i+1}')
            
            # Create DataFrame
            df = pd.DataFrame(data, columns=columns)
            
            # Add time column (in seconds)
            df['time'] = (df['sample'] - 1) / info['sampling_rate']
            
            # Reorder columns to have time after sample
            time_col = df.pop('time')
            df.insert(1, 'time', time_col)
            
            # Output file name
            output_name = f"{info['record_name']}.csv"
            output_path = Path(output_folder) / output_name
            
            # Save as CSV
            df.to_csv(output_path, index=False, encoding='utf-8-sig')
            
            print(f"\nCreated: {output_name}")
            print(f"   Size: {os.path.getsize(output_path) / 1024:.1f} KB")
            print(f"   Rows: {len(df)}")
            print(f"   Columns: {len(df.columns)}")
            print(f"   Column names: {', '.join(df.columns)}")
            
            return {
                'path': str(output_path),
                'name': output_name,
                'rows': len(df),
                'columns': len(df.columns),
                'sampling_rate': info['sampling_rate'],
                'duration': info['num_samples'] / info['sampling_rate']
            }
            
    except Exception as e:
        print(f"Error: {e}")
        return None

def print_summary(result):
    """Print conversion summary"""
    if not result:
        return
    
    print("\n" + "="*50)
    print("CONVERSION SUCCESSFUL")
    print("="*50)
    print(f"File: {result['name']}")
    print(f"Data: {result['rows']} rows × {result['columns']} columns")
    print(f"Duration: {result['duration']:.1f} seconds")
    print(f"Sampling rate: {result['sampling_rate']} Hz")
    print(f"Path: {result['path']}")
    
    # Preview first 5 rows
    if os.path.exists(result['path']):
        df = pd.read_csv(result['path'])
        print("\n📋 Preview (first 5 rows):")
        print(df.head().to_string())

def main():
    """Main function"""
    print("="*50)
    print("ZIP to CSV Converter - ECG Files")
    print("="*50)
    
    # Select ZIP file
    print("\n1. Select ZIP file...")
    zip_path = select_zip_file()
    
    if not zip_path:
        print("No file selected")
        return
    
    print(f"Selected: {os.path.basename(zip_path)}")
    
    # Select output folder
    print("\n2. Select output folder...")
    output_folder = select_output_folder()
    
    if not output_folder:
        print(" No folder selected")
        return
    
    print(f"Output folder: {output_folder}")
    
    # Start conversion
    print("\n3. Starting conversion...")
    result = convert_zip_to_csv(zip_path, output_folder)
    
    if result:
        print_summary(result)
        messagebox.showinfo("Success", 
            f"File created successfully:\n{result['name']}\n\n"
            f"Rows: {result['rows']}\n"
            f"Duration: {result['duration']:.1f} seconds")
    else:
        print("\n Conversion failed")
        messagebox.showerror("Failed", "Could not convert the file")

if __name__ == "__main__":
    main()