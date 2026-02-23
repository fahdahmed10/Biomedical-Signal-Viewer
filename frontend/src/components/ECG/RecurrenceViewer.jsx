import { useState, useEffect, useMemo } from "react";
import Plot from "react-plotly.js";

const defaultColors = [
  "#FF4136",
  "#0074D9",
  "#2ECC40",
  "#FF851B",
  "#B10DC9",
  "#FFDC00",
];

export default function RecurrenceViewer({ data }) {
  const safeData = data || { time: [], signals: {}, channels: [] };
  const { time = [], signals: origSignals = {}, channels: origChannels = [] } = safeData;

  const [extraSignals, setExtraSignals] = useState({});
  const [extraChannels, setExtraChannels] = useState([]);
  
  const allSignals = { ...origSignals, ...extraSignals };
  const allChannels = [...origChannels, ...extraChannels];

  const [xChannel, setXChannel] = useState("");
  const [yChannel, setYChannel] = useState("");
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [speed, setSpeed] = useState(1); 
  
  const [showCombinationUI, setShowCombinationUI] = useState(false);
  const [selectedForCombination, setSelectedForCombination] = useState([]);

  // Reset when data changes
  useEffect(() => {
    if (!data) return;
    setExtraSignals({});
    setExtraChannels([]);
    setIndex(0);
    setIsPlaying(false);

    if (origChannels.length >= 2) {
      setXChannel(origChannels[0]);
      setYChannel(origChannels[1]);
    }
  }, [data]);

  // Animation
  useEffect(() => {
    if (!isPlaying || time.length === 0) return;
    const interval = setInterval(() => {
      setIndex(prev => Math.min(prev + speed, time.length));
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying, speed, time.length]);

  const toggleSelectForCombination = (ch) => {
    setSelectedForCombination(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const createCombination = () => {
    if (selectedForCombination.length === 0 || !time?.length) {
      alert("Select at least one channel");
      return;
    }

    const name = selectedForCombination.length === allChannels.length
      ? "Average (All)"
      : "Avg_" + selectedForCombination.join("+");

    const avgSignal = Array(time.length).fill(0);

    selectedForCombination.forEach(ch => {
      const signal = allSignals[ch];
      if (signal?.length === time.length) {
        for (let i = 0; i < time.length; i++) {
          avgSignal[i] += signal[i] || 0;
        }
      }
    });

    for (let i = 0; i < time.length; i++) {
      avgSignal[i] = avgSignal[i] / selectedForCombination.length;
    }

    setExtraSignals(prev => ({ ...prev, [name]: avgSignal }));
    setExtraChannels(prev => [...prev, name]);

    setSelectedForCombination([]);
    setShowCombinationUI(false);
  };

  // Safe range calculation
  const getRange = arr => {
    if (!arr || arr.length === 0) return [-1, 1];
    let min = arr[0], max = arr[0];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < min) min = arr[i];
      if (arr[i] > max) max = arr[i];
    }
    const padding = (max - min) * 0.1 || 0.5;
    return [min - padding, max + padding];
  };

  const xRange = useMemo(() => getRange(allSignals[xChannel]), [allSignals, xChannel]);
  const yRange = useMemo(() => getRange(allSignals[yChannel]), [allSignals, yChannel]);
  const xData = allSignals[xChannel]?.slice(0, index) || [];
  const yData = allSignals[yChannel]?.slice(0, index) || [];

  // Color bins for animation
  const binSize = 0.2;
  const timeSlice = time.slice(0, index).map(t => Math.floor(t / binSize));
  const dynamicMax = timeSlice.length > 0 ? Math.max(...timeSlice) : 1;
  const handleReset = () => { setIndex(0); setIsPlaying(false); };
  const showPlaceholder = !data || allChannels.length < 2;

  return (
    <div className="viewer-container">

      {/* ===== Controls Panel ===== */}
      <div className="controls-panel">
        <h3>Recurrence Controls</h3>

        <p style={{ color: "#888", fontSize: 12 }}>
          {showPlaceholder ? "Upload ECG data to start." : "Data Loaded ✔"}
        </p>

        <label className="control-label">X Axis:</label>
        <select
          value={xChannel}
          onChange={e => setXChannel(e.target.value)}
          disabled={showPlaceholder}
        >
          {allChannels.length > 0
            ? allChannels.map(ch => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))
            : <option>No Channels</option>}
        </select>

        <label className="control-label">Y Axis:</label>
        <select
          value={yChannel}
          onChange={e => setYChannel(e.target.value)}
          disabled={showPlaceholder}
        >
          {allChannels.length > 0
            ? allChannels.map(ch => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))
            : <option>No Channels</option>}
        </select>

        <hr className="section-divider" />

        <button
          className="ecg-btn-primary create-combination-btn"
          onClick={() => setShowCombinationUI(!showCombinationUI)}
          style={{ 
            width: '100%', 
            padding: '12px 14px',
            fontSize: '0.95rem',
            whiteSpace: 'normal',
            minHeight: '45px',
            lineHeight: '1.3',
            marginBottom: '10px'
          }}
        >
          Create Average Combination
        </button>

        {showCombinationUI && (
          <div className="combination-box" style={{ marginBottom: '10px' }}>
            <p style={{ marginBottom: '10px', fontWeight: 'bold' }}>Select channels to average:</p>
            {allChannels.map(ch => (
              <div key={ch} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={selectedForCombination.includes(ch)}
                  onChange={() => toggleSelectForCombination(ch)}
                  style={{ marginRight: '10px' }}
                />
                <span style={{ flex: 1 }}>{ch}</span>
              </div>
            ))}

            <button
              className="ecg-btn-success"
              onClick={createCombination}
              style={{ 
                width: '100%', 
                marginTop: '10px',
                padding: '10px',
                fontWeight: 'bold'
              }}
            >
              Average Selected ({selectedForCombination.length} channel{selectedForCombination.length !== 1 ? 's' : ''})
            </button>
          </div>
        )}

        <hr className="section-divider" />

        {/* ===== Playback Controls ===== */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={showPlaceholder}
          className={`ecg-btn ${isPlaying ? 'ecg-btn-danger' : 'ecg-btn-success'}`}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <button
          onClick={handleReset}
          disabled={showPlaceholder}
          className="ecg-btn-primary"
        >
          Restart
        </button>

        <label className="control-label">Speed: {speed}x</label>
        <input
          type="range"
          min="0.5"        
          max="5"          
          step="0.5"       
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          disabled={showPlaceholder}
          className="range-slider"
        />
      </div>

      {/* ===== Plot Area ===== */}
      <div className="plot-container">
        <input
          type="range"
          min="0"
          max={time.length}
          value={index}
          onChange={e => setIndex(Number(e.target.value))}
          disabled={showPlaceholder}
          className="full-input plot-timeline"
        />

        <div className="plot-wrapper">
          <Plot
            useResizeHandler
            style={{ width: "100%", height: "100%" }}
            config={{
              responsive: true,
              scrollZoom: true,
              displayModeBar: true
            }}
            data={[
              {
                x: showPlaceholder ? [0] : xData,
                y: showPlaceholder ? [0] : yData,
                mode: "markers",
                type: "scattergl",
                marker: {
                  size: 4,
                  color: showPlaceholder ? [0] : timeSlice,
                  colorscale: "Turbo",
                  cmin: 0,
                  cmax: showPlaceholder ? 1 : dynamicMax,
                  showscale: !showPlaceholder
                }
              }
            ]}
            layout={{
              autosize: true,
              dragmode: "pan",
              title: showPlaceholder
                ? "Recurrence Graph (Waiting for Data)"
                : `${xChannel} vs ${yChannel}`,
              xaxis: {
                title: showPlaceholder ? "X" : xChannel,
                range: showPlaceholder ? [-1, 1] : xRange,
                autorange: false,
                fixedrange: false,
                gridcolor: "#333"
              },
              yaxis: {
                title: showPlaceholder ? "Y" : yChannel,
                range: showPlaceholder ? [-1, 1] : yRange,
                autorange: false,
                fixedrange: false,
                gridcolor: "#333"
              },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "white" }
            }}
          />
        </div>
      </div>
    </div>
  );
}