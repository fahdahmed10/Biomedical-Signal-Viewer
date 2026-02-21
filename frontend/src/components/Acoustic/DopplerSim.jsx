import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import { FaPlay, FaSpinner, FaStop } from "react-icons/fa";

const DopplerSim = () => {
  // --- 1. STATE ---
  const [simParams, setSimParams] = useState({
    velocity: 50,
    frequency: 400,
    duration: 2.0,
    num_points_per_second: 8000
  });

  const [plotData, setPlotData] = useState([]);
  const [plotLayout, setPlotLayout] = useState({});
  const [frames, setFrames] = useState({ x: [], y: [] });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const audioCtxRef = useRef(null);
  const animationRef = useRef(null);

  // EFFECTS 
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, []);

  //  HANDLERS 
  const handleSimChange = (e) => {
    const { name, value } = e.target;
    setSimParams((prev) => ({ ...prev, [name]: Number(value) }));
  };

  const generateSignal = async () => {
    setIsLoading(true);
    setError(null);
    setIsPlaying(false);
    setPlotData([]);

    try {
      const response = await axios.post('http://127.0.0.1:8000/doppler_generation', {
        velocity: simParams.velocity,
        frequency: simParams.frequency,
        duration: simParams.duration,
        num_points_per_second: simParams.num_points_per_second
      });

      const backendData = response.data;

      // 1. Extract Signal
      let fullSignal = backendData;
      if (fullSignal.signal && fullSignal.signal.Signal) fullSignal = fullSignal.signal.Signal;
      else if (fullSignal.signal) fullSignal = fullSignal.signal;
      else if (fullSignal.Signal) fullSignal = fullSignal.Signal;

      if (!Array.isArray(fullSignal)) throw new Error("Invalid data format received");

      // 2. Extract Time from API
      // We default to the API 'Time' array. 
      // If for some reason it's missing, we fall back to manual generation to prevent crash.
      let timeArray = backendData.Time;
      
      if (!timeArray || !Array.isArray(timeArray)) {
          console.warn("API did not return 'Time' array. Falling back to manual generation.");
          timeArray = Array.from({ length: fullSignal.length }, (_, i) => i / simParams.num_points_per_second);
      }

      setFrames({ x: timeArray, y: fullSignal });

      // Calculate dynamic range for X-axis based on the API time data
      const startTime = timeArray[0];
      const endTime = timeArray[timeArray.length - 1];

      // Initialize Plotly Layout
      setPlotLayout({
        title: 'Doppler Effect (Real-time)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#fff' },
        xaxis: { 
            title: 'Time (s)', 
            range: [startTime, endTime], // Dynamic range from API data
            gridcolor: '#333' 
        },
        yaxis: { title: 'Amplitude', range: [-35000, 35000], gridcolor: '#333' },
        margin: { t: 40, r: 10, l: 50, b: 40 },
        autosize: true
      });

      // Start animation and sound
      setIsLoading(false);
      startPlayback(fullSignal, simParams.num_points_per_second, timeArray);

    } catch (err) {
      console.error(err);
      setError("Failed to fetch signal. Check console.");
      setIsLoading(false);
    }
  };

  const startPlayback = (signalArray, sampleRate, timeArray) => {
  if (!signalArray || signalArray.length === 0) return;

  // 1. Initialize Audio
  if (!audioCtxRef.current) {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
  }
  const ctx = audioCtxRef.current;
  
  // Normalize Int16 to Float32
  const floatArray = new Float32Array(signalArray.length);
  for (let i = 0; i < signalArray.length; i++) {
    floatArray[i] = signalArray[i] / 32768.0;
  }

  const buffer = ctx.createBuffer(1, floatArray.length, sampleRate);
  buffer.copyToChannel(floatArray, 0);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  // 2. Start Timing
  const startTime = ctx.currentTime; // This is the 'zero' moment
  source.start();
  setIsPlaying(true);

  const animate = () => {
    // 3. Calculate exactly where we are based on the AUDIO clock
    const now = ctx.currentTime;
    const elapsedTime = now - startTime;
    const totalDuration = buffer.duration;

    if (elapsedTime >= totalDuration) {
      setIsPlaying(false);
      // Show full signal at the end
      setPlotData([{
        x: timeArray,
        y: signalArray,
        type: 'scattergl',
        mode: 'lines',
        line: { color: '#00c6ff', width: 2 }
      }]);
      return;
    }

    // 4. Map time to array index
    // Example: if 15s have passed out of 30s, show 50% of the array
    const progressPercent = elapsedTime / totalDuration;
    const currentLimit = Math.floor(progressPercent * signalArray.length);

    // 5. Update Plot (Optimized: only update every ~30ms to save CPU)
    // You can wrap this in a check if you want, but Plotly usually handles this
    setPlotData([{
      x: timeArray.slice(0, currentLimit),
      y: signalArray.slice(0, currentLimit),
      type: 'scatter',
      mode: 'lines',
      line: { color: '#00c6ff', width: 2 },
    }]);

    animationRef.current = requestAnimationFrame(animate);
  };

  cancelAnimationFrame(animationRef.current);
  animate();
};

  return (
    <section id="section-sim" className="task-section">
      <h2>1. Vehicle-Passing Simulation</h2>
      <div className="workspace">
        
        <div className="sim-visualizer">
          {frames.y.length > 0 ? (
            <div className="chart-wrapper">
              <Plot
                data={plotData}
                layout={plotLayout}
                style={{ width: "100%", height: "100%" }}
                useResizeHandler={true}
                config={{ displayModeBar: false }}
              />
            </div>
          ) : (
            <div className="chart-placeholder">
              {isLoading ? <FaSpinner className="spinner" size={60}/> : <p>Signal will appear here</p>}
            </div>
          )}
        </div>

        <div className="sim-controls">
          <h3>Parameters</h3>
          <div className="control-group">
            <label>Velocity (v): <span>{simParams.velocity} m/s</span></label>
            <input type="range" name="velocity" min="10" max="500" value={simParams.velocity} onChange={handleSimChange} />
          </div>

          <div className="control-group">
            <label>Frequency (f): <span>{simParams.frequency} Hz</span></label>
            <input type="range" name="frequency" min="200" max="1000" step="50" value={simParams.frequency} onChange={handleSimChange} />
          </div>

          <div className="control-group">
            <label>Duration: <span>{simParams.duration} s</span></label>
            <input type="number" name="duration" min="0.5" max="5.0" step="0.5" value={simParams.duration} onChange={handleSimChange} />
          </div>

          <div className="control-group">
            <label>Sample Rate: <span>{simParams.num_points_per_second} Hz</span></label>
            <select name="num_points_per_second" value={simParams.num_points_per_second} onChange={handleSimChange}>
              <option value="8000">8000 Hz</option>
              <option value="16000">16000 Hz</option>
              <option value="44100">44100 Hz</option>
            </select>
          </div>

          <button className="generate-btn" onClick={generateSignal} disabled={isLoading || isPlaying}>
            {isLoading ? "Processing..." : isPlaying ? <><FaStop/> Playing...</> : <><FaPlay /> Generate & Play</>}
          </button>
          {error && <div className="error-msg">{error}</div>}
        </div>

      </div>
    </section>
  );
};

export default DopplerSim;