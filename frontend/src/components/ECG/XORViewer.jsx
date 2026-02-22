import { useState, useEffect, useRef, useMemo } from "react";
import Plot from "react-plotly.js";

const defaultColors = [
  "#FF4136",
  "#0074D9",
  "#2ECC40",
  "#FF851B",
  "#B10DC9",
  "#FFDC00",
];

export default function XORViewer({ data }) {
  const safeData = data || { time: [], signals: {}, channels: [] };
  const { time = [], signals: origSignals = {}, channels: origChannels = [] } = safeData;

  // State for original and extra signals
  const [extraSignals, setExtraSignals] = useState({});
  const [extraChannels, setExtraChannels] = useState([]);
  
  const allSignals = { ...origSignals, ...extraSignals };
  const allChannels = [...origChannels, ...extraChannels];

  // UI State
  const [visibleChannels, setVisibleChannels] = useState([]);
  const [colors, setColors] = useState({});
  
  // XOR specific state
  const [windowSize, setWindowSize] = useState(1.0); // seconds
  const [index, setIndex] = useState(0); // current time index
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  
  // Combination UI
  const [showCombinationUI, setShowCombinationUI] = useState(false);
  const [selectedForCombination, setSelectedForCombination] = useState([]);

  const requestRef = useRef(null);

  /* ================= INIT ================= */
  useEffect(() => {
    if (origChannels.length > 0) {
      setVisibleChannels(origChannels);
      setColors(
        Object.fromEntries(
          origChannels.map((ch, i) => [
            ch,
            defaultColors[i % defaultColors.length],
          ])
        )
      );
    } else {
      setVisibleChannels([]);
      setColors({});
    }

    setExtraSignals({});
    setExtraChannels([]);
    setIndex(0);
    setIsPlaying(false);
  }, [origChannels]);

  /* ================= PLAY ANIMATION ================= */
  useEffect(() => {
    const animate = () => {
      setIndex((prev) => {
        const next = prev + speed;
        if (next >= time.length - 1) {
          setIsPlaying(false);
          return time.length - 1;
        }
        return next;
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying && time.length > 0) {
      requestRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, speed, time.length]);

  /* ================= CHANNEL TOGGLE ================= */
  const toggleChannel = (ch) => {
    setVisibleChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const selectAllChannels = () => {
    setVisibleChannels([...allChannels]);
  };

  const clearAllChannels = () => {
    setVisibleChannels([]);
  };

  /* ================= COMBINATION FUNCTIONS ================= */
  const toggleSelectForCombination = (ch) => {
    setSelectedForCombination((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const createCombination = () => {
    if (selectedForCombination.length === 0) {
      alert("Select at least one channel");
      return;
    }

    // Create average combination name
    const name =
      selectedForCombination.length === allChannels.length
        ? "Avg_XOR (All)"
        : "Avg_XOR_" + selectedForCombination.join("+");

    // Calculate average signal
    const avgSignal = Array(time.length).fill(0);

    selectedForCombination.forEach((ch) => {
      for (let i = 0; i < time.length; i++) {
        avgSignal[i] += allSignals[ch]?.[i] || 0;
      }
    });

    // Divide by number of channels for average
    for (let i = 0; i < time.length; i++) {
      avgSignal[i] = avgSignal[i] / selectedForCombination.length;
    }

    // Add to extra signals
    setExtraSignals((prev) => ({ ...prev, [name]: avgSignal }));
    setExtraChannels((prev) => [...prev, name]);
    setVisibleChannels((prev) => [...prev, name]);
    setColors((prev) => ({ ...prev, [name]: "#FF00FF" })); // Magenta for averages

    // Reset selection
    setSelectedForCombination([]);
    setShowCombinationUI(false);
  };

  /* ================= XOR CALCULATION ================= */
  const traces = useMemo(() => {
    if (!time.length || !visibleChannels.length) return [];

    const result = [];
    const currentTime = time[index] ?? 0;
    const startTime = currentTime - windowSize;
    const prevStartTime = startTime - windowSize;

    visibleChannels.forEach((ch) => {
      const signal = allSignals[ch] || [];

      // Find indices for current chunk and previous chunk
      const currentIndices = [];
      const prevIndices = [];

      for (let i = 0; i < time.length; i++) {
        // Current chunk (from startTime to currentTime)
        if (time[i] >= startTime && time[i] <= currentTime) {
          currentIndices.push(i);
        }
        // Previous chunk (from prevStartTime to startTime)
        if (time[i] >= prevStartTime && time[i] < startTime) {
          prevIndices.push(i);
        }
      }

      // Need at least 2 points for both chunks
      const minLength = Math.min(currentIndices.length, prevIndices.length);
      if (minLength < 2) return;

      // Calculate XOR values
      const xorValues = [];
      const xorTime = [];

      for (let i = 0; i < minLength; i++) {
        // XOR = absolute difference between current and previous chunk
        const xorValue = Math.abs(
          (signal[currentIndices[i]] || 0) - (signal[prevIndices[i]] || 0)
        );
        
        // Only add non-zero values (if chunks are identical, XOR = 0, they get erased)
        if (xorValue > 0.01) { // Small threshold to handle floating point
          xorValues.push(xorValue);
          xorTime.push(time[currentIndices[i]]);
        }
      }

      if (xorValues.length > 0) {
        result.push({
          type: "scatter",
          mode: "lines",
          x: xorTime,
          y: xorValues,
          name: ch,
          line: {
            color: colors[ch],
            width: ch.startsWith("Avg_XOR") ? 3 : 2, // Thicker line for averages
          },
          opacity: ch.startsWith("Avg_XOR") ? 1 : 0.8,
        });
      }
    });

    return result;
  }, [index, visibleChannels, windowSize, allSignals, colors, time]);

  /* ================= RENDER ================= */
  return (
    <div className="viewer-container">

      {/* ===== Sidebar Controls ===== */}
      <div className="controls-panel">
        <h3>XOR Controls</h3>

        {/* Channel Selection Buttons */}
        <div className="button-group">
          <button onClick={selectAllChannels} className="ecg-btn-primary">
            Select All
          </button>
          <button onClick={clearAllChannels} className="ecg-btn">
            Clear All
          </button>
        </div>

        {/* Channel List */}
        {allChannels.map((ch) => (
          <div key={ch} className="channel-row">
            <input
              type="checkbox"
              checked={visibleChannels.includes(ch)}
              onChange={() => toggleChannel(ch)}
            />
            <span>{ch}</span>
            <input
              type="color"
              value={colors[ch] || "#000000"}
              onChange={(e) =>
                setColors({ ...colors, [ch]: e.target.value })
              }
              className="color-picker"
            />
          </div>
        ))}

        <hr />

        {/* Create Average Combination Button */}
        <button
          className="ecg-btn-primary"
          onClick={() => setShowCombinationUI(!showCombinationUI)}
        >
          {showCombinationUI ? "Cancel" : "Create Average Combination"}
        </button>

        {/* Combination UI */}
        {showCombinationUI && (
          <div className="combination-box">
            <p>Select channels to average:</p>
            {allChannels.map((ch) => (
              <div key={ch}>
                <input
                  type="checkbox"
                  checked={selectedForCombination.includes(ch)}
                  onChange={() => toggleSelectForCombination(ch)}
                />
                <span>{ch}</span>
              </div>
            ))}
            <button
              onClick={createCombination}
              className="ecg-btn-success"
            >
              Average Selected ({selectedForCombination.length})
            </button>
          </div>
        )}

        <hr />

        {/* Window Size Control */}
        <label>Window Size (seconds): {windowSize.toFixed(1)}s</label>
        <input
          type="range"
          min="0.2"
          max="5"
          step="0.1"
          value={windowSize}
          onChange={(e) => setWindowSize(Number(e.target.value))}
        />

        {/* Playback Controls */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`ecg-btn ${isPlaying ? "ecg-btn-danger" : "ecg-btn-success"}`}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <button
          onClick={() => {
            setIndex(0);
            setIsPlaying(false);
          }}
          className="ecg-btn-primary"
        >
          Restart
        </button>

        {/* Speed Control */}
        <label>Speed: {speed}x</label>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.5"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
      </div>

      {/* ===== Plot Area ===== */}
      <div className="plot-container">
        {/* Timeline Slider */}
        <label>Timeline Progress</label>
        <input
          type="range"
          min="0"
          max={Math.max(0, time.length - 1)}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="full-input plot-timeline"
        />

        {/* XOR Plot */}
        <div className="plot-wrapper">
          <Plot
            data={traces}
            layout={{
              title: "ECG XOR (Chunk Difference)",
              xaxis: { 
                title: "Time (seconds)",
                gridcolor: "#333",
                zerolinecolor: "#444"
              },
              yaxis: { 
                title: "XOR Value (|Δ|)",
                gridcolor: "#333",
                zerolinecolor: "#444"
              },
              legend: { 
                orientation: "h", 
                y: -0.2,
                font: { color: "#fff" }
              },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "white" },
              margin: { t: 50, b: 50, l: 50, r: 20 },
              hovermode: "closest"
            }}
            config={{ 
              responsive: true, 
              scrollZoom: true,
              displayModeBar: false 
            }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>

        {/* Info Text */}
        {traces.length === 0 && time.length > 0 && (
          <p style={{ textAlign: "center", color: "var(--text-dim)", marginTop: "10px" }}>
            No XOR values to display. Try increasing window size or selecting different channels.
          </p>
        )}
      </div>

    </div>
  );
}