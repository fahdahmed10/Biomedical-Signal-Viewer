import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import axios from 'axios';

const API_URL = "http://127.0.0.1:8000"; 

const VelocityEst = () => {
  const [file, setFile] = useState(null);
  const [audioSrc, setAudioSrc] = useState(null); // State for the audio player URL
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null); // Stores { velocity, frequency, signal }

  // Handle File Selection
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);

      const url = URL.createObjectURL(selectedFile);
      setAudioSrc(url);

      setError(null);
      setData(null); // Reset previous results
    }
  };

  // Clean up the object URL when component unmounts or file changes to avoid memory leaks
  useEffect(() => {
    return () => {
      if (audioSrc) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc]);

  // Handle "Run Analysis"
  const handleRunAnalysis = async () => {
    if (!file) {
      setError("Please select an audio file first.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_URL}/extract_coef`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const rawSignal = response.data.signal;
      
      // ==========================================
      // FIX: DOWNSAMPLE THE SIGNAL TO PREVENT LAG
      // ==========================================
      const maxPoints = 800; // Optimal number of points for smooth Recharts rendering
      const step = Math.max(1, Math.ceil(rawSignal.length / maxPoints));
      
      const chartData = [];
      for (let i = 0; i < rawSignal.length; i += step) {
        chartData.push({
          time: i, 
          amplitude: rawSignal[i]
        });
      }
      // ==========================================

      setData({
        velocity: response.data.velocity,
        frequency: response.data.frequency,
        chartData: chartData // Passing the smaller, optimized array
      });

    } catch (err) {
      console.error(err);
      setError("Analysis failed. Please try a valid .wav or .mp3 file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="task-section" id="section-est">
      <h2>2. Velocity & Frequency Estimation</h2>
      
      <div className="workspace est-workspace">
        
        {/*  Upload (Left) and Graph (Right) */}
        <div className="est-main-row">
          
          {/* left: Upload Panel */}
          <div className="upload-panel">
            <h3>Input Source</h3>
            
            <div className="file-drop-zone">
              <input 
                type="file" 
                accept=".wav,.mp3" 
                id="audio-upload" 
                onChange={handleFileChange} 
                hidden 
              />
              <label htmlFor="audio-upload" className="upload-label">
                <span className="icon"></span>
                <span>{file ? file.name : "Click to Upload Audio"}</span>
                <small>.wav or .mp3 supported</small>
              </label>
            </div>

            {/* AUDIO PLAYER - Only shows if a file is selected */}
            {audioSrc && (
              <div className="audio-player-container" style={{ width: '100%', marginTop: '10px' }}>
                <audio controls src={audioSrc} style={{ width: '100%', height: '40px' }}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}

            <button 
              className="run-btn" 
              onClick={handleRunAnalysis} 
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Run Analysis"}
            </button>
            
            {error && <div className="error-msg">{error}</div>}
          </div>

          {/* right: Visualizer Panel */}
          <div className="est-visualizer">
            {data ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: 'none', color: '#fff' }} 
                    itemStyle={{ color: '#38bdf8' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amplitude" 
                    stroke="#00c6ff" 
                    strokeWidth={2} 
                    dot={false} 
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">
                <p>Waiting for signal analysis...</p>
              </div>
            )}
          </div>
        </div>

        {/* Results Cards */}
        <div className="est-results-row">
          {/* Card 1: Velocity */}
          <div className="result-card">
            <span className="res-value">
              {data && data.velocity !== undefined && data.velocity !== null ? data.velocity.toFixed(2) : "--"}
            </span>
            <span className="res-label">EST. VELOCITY (M/S)</span>
          </div>

          {/* Card 2: Frequency */}
          <div className="result-card">
            <span className="res-value">
              {data && data.frequency !== undefined && data.frequency !== null ? data.frequency.toFixed(2) : "--"}
            </span>
            <span className="res-label">EST. FREQUENCY (HZ)</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VelocityEst;