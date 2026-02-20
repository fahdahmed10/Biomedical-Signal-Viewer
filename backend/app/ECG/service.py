import pandas as pd
import io


async def parse_ecg(file):

    contents = await file.read()

    df = pd.read_csv(io.StringIO(contents.decode("utf-8")))

    # normalize column names
    df.columns = [c.lower() for c in df.columns]

    # -------- Time Axis --------
    if "time" in df.columns:
        time = df["time"].tolist()
        channels = [c for c in df.columns if c != "time"]

    else:
        fs = 360  # default sampling rate
        time = [i / fs for i in range(len(df))]
        channels = df.columns.tolist()

    # -------- Signals --------
    signals = {
        ch: df[ch].astype(float).tolist()
        for ch in channels
    }

    duration = float(time[-1]) if time else None

    return {
        "num_channels": len(channels),
        "channels": channels,
        "num_samples": len(df),
        "duration": duration,
        "time": time,
        "signals": signals
    }
