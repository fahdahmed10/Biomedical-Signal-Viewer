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
  // ========== DATA INIT ==========
  const safeData = data || { time: [], signals: {}, channels: [] };
  const { time = [], signals: origSignals = {}, channels: origChannels = [] } = safeData;

  const [extraSignals, setExtraSignals] = useState({});
  const [extraChannels, setExtraChannels] = useState([]);
  
  const allSignals = { ...origSignals, ...extraSignals };
  const allChannels = [...origChannels, ...extraChannels];

  // ========== STATE ==========
  const [visibleChannels, setVisibleChannels] = useState([]);
  const [colors, setColors] = useState({});
  
  const [chunkSize, setChunkSize] = useState(1.0); 
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  
  const [index, setIndex] = useState(0);
  const windowSize = 400;
  
  const [showCombinationUI, setShowCombinationUI] = useState(false);
  const [selectedForCombination, setSelectedForCombination] = useState([]);

  const requestRef = useRef(null);

  
  // ========== INIT ==========
  useEffect(() => {
    if (origChannels?.length > 0) {
      setVisibleChannels(origChannels);
      setColors(
        Object.fromEntries(
          origChannels.map((ch, i) => [
            ch,
            defaultColors[i % defaultColors.length],
          ])
        )
      );
    }
    setExtraSignals({});
    setExtraChannels([]);
    setIndex(0);
    setIsPlaying(false);
  }, [origChannels]);

  // ========== TIMELINE ANIMATION ==========
  useEffect(() => {
    const animate = () => {
      setIndex(prev => {
        const next = prev + speed;
        if (next >= time.length - windowSize) {
          setIsPlaying(false);
          return Math.max(0, time.length - windowSize);
        }
        return next;
      });
      requestRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying && time.length > 0) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, speed, time.length, windowSize]);

  // ========== CHANNEL CONTROLS ==========
  const toggleChannel = (ch) => {
    setVisibleChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const selectAllChannels = () => {
    if (allChannels.length) setVisibleChannels([...allChannels]);
  };

  const clearAllChannels = () => {
    setVisibleChannels([]);
  };

  // ========== COMBINATION ==========
  const toggleSelectForCombination = (ch) => {
    setSelectedForCombination(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const createCombination = () => {
    if (!selectedForCombination.length || !time?.length) {
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
    setVisibleChannels(prev => [...prev, name]);
    setColors(prev => ({ ...prev, [name]: "#FF00FF" }));

    setSelectedForCombination([]);
    setShowCombinationUI(false);
  };

  const xorTraces = useMemo(() => {
    if (!time?.length || !visibleChannels?.length) return [];

    const traces = [];
    const startTime = time[0];
    const currentTime = time[index];
    const endTime = time[Math.min(index + windowSize, time.length - 1)]; 

    visibleChannels.forEach(ch => {
      const signal = allSignals[ch];
      if (!signal?.length) return;

      const channelColor = colors[ch] || defaultColors[visibleChannels.indexOf(ch) % defaultColors.length];

      const startChunk = Math.floor((currentTime - startTime) / chunkSize);
      const endChunk = Math.floor((endTime - startTime) / chunkSize);

      for (let chunkIdx = startChunk; chunkIdx <= endChunk; chunkIdx++) {
        if (chunkIdx < 1) continue; 

        const currentStart = startTime + chunkIdx * chunkSize;
        const currentEnd = currentStart + chunkSize;
        const prevStart = startTime + (chunkIdx - 1) * chunkSize;
        const prevEnd = prevStart + chunkSize;

        const currentIndices = [];
        const prevIndices = [];

        for (let i = 0; i < time.length; i++) {
          const t = time[i];
          if (t >= currentStart && t < currentEnd) currentIndices.push(i);
          if (t >= prevStart && t < prevEnd) prevIndices.push(i);
        }

        const minPoints = Math.min(currentIndices.length, prevIndices.length);
        if (minPoints < 2) continue; 

        let identical = true;
        const threshold = 0.01;
        for (let i = 0; i < minPoints; i++) {
          const valCurrent = signal[currentIndices[i]] || 0;
          const valPrev = signal[prevIndices[i]] || 0;
          if (Math.abs(valCurrent - valPrev) > threshold) {
            identical = false;
            break;
          }
        }

        if (identical) continue;


        const xVals = currentIndices.map(i => time[i]);
        const yVals = currentIndices.map(i => signal[i] || 0);

        traces.push({
          type: "scattergl", 
          mode: "lines",
          x: xVals,
          y: yVals,
          name: ch,
          line: { color: channelColor, width: 1.5 },
          opacity: 0.5, 
          showlegend: false, 
        });
      }

      if (traces.length > 0) {
        const firstTraceIndex = traces.findIndex(t => t.name === ch);
        if (firstTraceIndex !== -1) {
          traces[firstTraceIndex].showlegend = true;
          traces[firstTraceIndex].name = ch; 
        }
      }
    });

    return traces;
  }, [time, visibleChannels, allSignals, colors, chunkSize, index, windowSize]);

  // ========== UTILS ==========
  const hasData = time?.length > 0;
  const maxSlider = Math.max(0, time.length - windowSize);
  const visibleTime = time.slice(index, index + windowSize);
  const visibleStart = visibleTime[0] || 0;
  const visibleEnd = visibleTime[visibleTime.length - 1] || 100;

  return (
    <div className="viewer-container">
      {/* ===== CONTROLS ===== */}
      <div className="controls-panel">
        <h3>XOR Controls</h3>

        <div className="button-group">
          <button onClick={selectAllChannels} className="ecg-btn-primary">Select All</button>
          <button onClick={clearAllChannels} className="ecg-btn">Clear All</button>
        </div>

        {allChannels.map(ch => (
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
              onChange={e => setColors({ ...colors, [ch]: e.target.value })}
              className="color-picker"
            />
          </div>
        ))}

        <hr className="section-divider" />

        <button
          className="ecg-btn-primary create-combination-btn"
          onClick={() => setShowCombinationUI(!showCombinationUI)}
        >
          {showCombinationUI ? "Cancel" : "Create Average"}
        </button>

        {showCombinationUI && (
          <div className="combination-box">
            <p>Select channels:</p>
            {allChannels.map(ch => (
              <div key={ch}>
                <input
                  type="checkbox"
                  checked={selectedForCombination.includes(ch)}
                  onChange={() => toggleSelectForCombination(ch)}
                />
                <span>{ch}</span>
              </div>
            ))}
            <button onClick={createCombination} className="ecg-btn-success">
              Average ({selectedForCombination.length})
            </button>
          </div>
        )}

        <hr className="section-divider" />

        <label className="control-label">Chunk Size: {chunkSize.toFixed(1)} s</label>
        <input
          type="range"
          min="0.2"
          max="5.0"
          step="0.1"
          value={chunkSize}
          onChange={e => setChunkSize(parseFloat(e.target.value))}
          className="range-slider"
        />

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={!hasData}
          className={`ecg-btn ${isPlaying ? "ecg-btn-danger" : "ecg-btn-success"}`}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <button
          onClick={() => {
            setIndex(0);
            setIsPlaying(false);
          }}
          disabled={!hasData}
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
          className="range-slider"
        />
      </div>

      {/* ===== PLOT ===== */}
      <div className="plot-container">
        {hasData && (
          <input
            type="range"
            min="0"
            max={maxSlider}
            value={index}
            onChange={e => setIndex(Number(e.target.value))}
            className="full-input plot-timeline"
            style={{ marginBottom: '10px' }}
          />
        )}

        <div className="plot-wrapper">
          <Plot
            data={xorTraces}
            layout={{
              title: hasData ? "XOR Graph (Overlapped Chunks)" : "No Data",
              xaxis: {
                title: "Time (s)",
                gridcolor: "#333",
                range: hasData ? [visibleStart, visibleEnd] : [0, 10],
              },
              yaxis: {
                title: "Amplitude",
                gridcolor: "#333",
              },
              legend: { orientation: "h", y: -0.2, font: { color: "#fff" } },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "white" },
              margin: { t: 40, b: 60, l: 50, r: 20 },
              dragmode: "pan",
            }}
            config={{ responsive: true, scrollZoom: true, displayModeBar: true }}
            style={{ width: "100%", height: "450px" }}
          />
        </div>
      </div>
    </div>
  );
}