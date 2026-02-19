import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import axios from 'axios';

const API_URL = "http://127.0.0.1:8000"; 

const SubMarineDetect = () => {
  const [file, setFile] = useState(null);
  const [audioSrc, setAudioSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // 1. Handle File Upload
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Create playable URL
      const url = URL.createObjectURL(selectedFile);
      setAudioSrc(url);
      
      // Reset State
      setError(null);
      setData(null);
    }
  };

  // Cleanup Audio URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (audioSrc) URL.revokeObjectURL(audioSrc);
    };
  }, [audioSrc]);

  // 2. Call API
  const handlePrediction = async () => {
    if (!file) {
      setError("Please select an audio file first.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // POST to /submarine_detection
      const response = await axios.post(`${API_URL}/submarine_detection`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Process Signal for Graph (Downsample if needed for performance)
      const rawSignal = response.data.signal;
      const chartData = rawSignal.map((val, index) => ({
        time: index, 
        amplitude: val
      }));

      setData({
        ...response.data, 
        chartData: chartData
      });

    } catch (err) {
      console.error(err);
      setError("Detection failed. Ensure the backend is running and file is valid.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to determine status color (Green for Safe, Red for Submarine)
  const isDanger = data && data.label.includes("SUBMARINE") && !data.label.includes("NO");
  const statusClass = !data ? "" : isDanger ? "danger" : "safe";

  return (
    <div className="task-section" id="section-submarine">
      <h2>3. AI Submarine Detection</h2>
      
      <div className="sub-split-container">
        
        {/*  left PANEL*/}
        <div className="sub-panel left-panel">
          <div className="panel-header">
            <h3>Mission Control</h3>
            <div className="status-dot"></div>
          </div>

          <div className="file-drop-zone">
            <input 
              type="file" 
              accept=".wav,.mp3" 
              id="sub-upload-input" 
              onChange={handleFileChange} 
              hidden 
            />
            <label htmlFor="sub-upload-input" className="upload-label">
              {/* <span className="icon"></span> */}
              <span>{file ? file.name : "Upload Hydrophone Audio"}</span>
              <small>.wav or .mp3 supported</small>
            </label>
          </div>

          {/* Audio Player */}
          {audioSrc && (
            <div className="audio-wrapper">
              <audio controls src={audioSrc}>
                Your browser does not support audio.
              </audio>
            </div>
          )}

          <button 
            className={`scan-btn ${loading ? 'scanning' : ''}`} 
            onClick={handlePrediction} 
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span> Scanning Sector...
              </>
            ) : (
              "Get Predection"
            )}
          </button>
          
          {error && <div className="error-msg">{error}</div>}
        </div>

        {/* right panel:*/}
        <div className={`sub-panel right-panel ${statusClass}`}>
          
          {/* 1. Signal Visualization (Top) */}
          <div className="sub-graph-container">
            {data ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  {/* <Tooltip 
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', color: '#fff' }} 
                    itemStyle={{ color: '#38bdf8' }}
                  /> */}
                  <Line 
                    type="monotone" 
                    dataKey="amplitude" 
                    stroke={isDanger ? "#38bdf8" : "#38bdf8"} 
                    strokeWidth={1.5} 
                    dot={false} 
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-sonar">
                <div className="sonar-ring"></div>
                <p>WAITING FOR SIGNAL INPUT</p>
              </div>
            )}
          </div>

          {/* 2. Model Confidence Metrics (Middle) */}
          <div className="sub-metrics-row">
            <div className="metric-box">
              <span className="m-label">ML prediction</span>
              <span className="m-value">{data ? `${data.ml_prediction}%` : "--"}</span>
            </div>
            <div className="metric-box">
              <span className="m-label">Dl prediction</span>
              <span className="m-value">{data ? `${data.dl_prediction}%` : "--"}</span>
            </div>
            <div className="metric-box highlight">
              <span className="m-label">AVG CONFIDENCE</span>
              <span className="m-value">{data ? `${data.mixed_approach}%` : "--"}</span>
            </div>
          </div>

          {/* 3. Final Verdict Label (Bottom) */}
          <div className={`sub-verdict-bar ${statusClass}`}>
            <span className="verdict-title">THREAT LEVEL ASSESSMENT:</span>
            <span className="verdict-result">
              {data ? data.label : "PENDING ANALYSIS"}
            </span>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SubMarineDetect;