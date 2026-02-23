import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Plot from "react-plotly.js";

const defaultColors = [
  "#FF4136", 
  "#0074D9", 
  "#2ECC40", 
  "#FF851B", 
  "#B10DC9",
  "#FFDC00", 
];

export default function PolarViewer({ data }) {
  // ========== 1. DATA INIT ==========
  const safeData = data || { time: [], signals: {}, channels: [] };
  const { time = [], signals: origSignals = {}, channels: origChannels = [] } = safeData;

  // ========== 2. STATE MANAGEMENT ==========
  const [extraSignals, setExtraSignals] = useState({});
  const [extraChannels, setExtraChannels] = useState([]);
  const allSignals = { ...origSignals, ...extraSignals };
  const allChannels = [...origChannels, ...extraChannels];

  const [visibleChannels, setVisibleChannels] = useState([]);
  const [colors, setColors] = useState({});

  // ===== Polar specific =====
  const [period, setPeriod] = useState(1.0); // Periodic time (seconds)

  // ===== Timeline controls =====
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const windowSize = 400;

  // ===== Combination UI =====
  const [showCombinationUI, setShowCombinationUI] = useState(false);
  const [selectedForCombination, setSelectedForCombination] = useState([]);

  const requestRef = useRef(null);

  // ========== 3. INITIALIZATION ==========
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

  // ========== 4. TIMELINE ANIMATION ==========
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

  // ========== 5. CHANNEL CONTROLS ==========
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

  // ========== 6. COMBINATION FUNCTIONS ==========
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

  // ========== 7. POLAR DATA PREPARATION ==========
  const polarTraces = useMemo(() => {
    if (!time?.length || time.length === 0) return [];
    if (!visibleChannels?.length || visibleChannels.length === 0) return [];

    const traces = [];
    
    const windowStart = 0;
    const windowEnd = index;

    if (windowEnd <= windowStart) return [];

    visibleChannels.forEach(ch => {
      try {
        const signal = allSignals[ch];
        if (!signal?.length || signal.length === 0) return;

        const channelColor = colors[ch] || defaultColors[visibleChannels.indexOf(ch) % defaultColors.length];

        const periods = {};
        
        for (let i = windowStart; i <= windowEnd; i++) {
          const t = time[i];
          if (period > 0) {
            const periodNum = Math.floor(t / period); 
            
            if (!periods[periodNum]) {
              periods[periodNum] = { r: [], theta: [] };
            }

            const val = signal[i];
            if (val !== undefined && val !== null && !isNaN(val)) {

              const theta = ((t % period) / period) * 360;
              
              periods[periodNum].r.push(val);
              periods[periodNum].theta.push(theta);
            }
          }
        }

        const periodKeys = Object.keys(periods)
          .map(Number)
          .sort((a, b) => a - b);

        periodKeys.forEach((periodNum, idx) => {
          const periodData = periods[periodNum];
          
          if (periodData.r.length > 1) {
            const points = periodData.theta.map((theta, i) => ({
              theta,
              r: periodData.r[i]
            }));
            
            points.sort((a, b) => a.theta - b.theta);
 
            const opacity = 0.5 + (idx / Math.max(1, periodKeys.length - 1)) * 0.5;
            
            traces.push({
              type: "scatterpolar",
              mode: "lines",
              r: points.map(p => p.r),
              theta: points.map(p => p.theta),
              name: idx === periodKeys.length - 1 ? ch : "",
              line: { 
                color: channelColor, 
                width: idx === periodKeys.length - 1 ? 3 : 2,
              },
              opacity: opacity,
              showlegend: idx === periodKeys.length - 1, 
            });
          }
        });

      } catch (error) {
        console.error(`Error processing channel ${ch}:`, error);
      }
    });

    return traces;
  }, [time, visibleChannels, allSignals, colors, period, index]);

  // ========== 8. UTILS ==========
  const hasData = time?.length > 0 && time.length > 0;
  
  const visibleStart = time && time.length > 0 && index < time.length ? time[index] : 0;
  const visibleEnd = time && time.length > 0 ? time[time.length - 1] : 0;

  const canShowData = hasData && visibleChannels.length > 0;

  return (
    <div className="viewer-container">
      {/* ===== CONTROLS PANEL ===== */}
      <div className="controls-panel">
        <h3>Polar Controls</h3>

        <div className="button-group">
          <button 
            onClick={selectAllChannels} 
            className="ecg-btn-primary"
          >
            Select All
          </button>
          <button 
            onClick={clearAllChannels} 
            className="ecg-btn"
          >
            Clear All
          </button>
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
          Create Average Combination
        </button>

        {showCombinationUI && (
          <div className="combination-box">
            <p>Select channels to average:</p>
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
            
            <button 
              onClick={createCombination} 
              className="ecg-btn-success"
            >
              Average ({selectedForCombination.length})
            </button>
          </div>
        )}

        <hr className="section-divider" />

        <label className="control-label">Period: {period.toFixed(2)}s</label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={period}
          onChange={e => setPeriod(Number(e.target.value))}
          className="range-slider"
        />

        <hr className="section-divider" />

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className={`ecg-btn ${isPlaying ? 'ecg-btn-danger' : 'ecg-btn-success'}`}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <button
          onClick={() => {
            setIndex(0);
            setIsPlaying(true);
          }}
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

      {/* ===== PLOT AREA ===== */}
      <div className="plot-container">

        {canShowData ? (
          <input
            type="range"
            min="0"
            max={time.length - 1}
            value={index}
            onChange={e => setIndex(Number(e.target.value))}
            className="full-input plot-timeline"
            style={{ marginBottom: '15px' }}
          />
        ) : (
          <div style={{ 
            height: '50px', 
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-dim)',
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '8px'
          }}>
            Select channels to enable timeline
          </div>
        )}

        {/* Plot */}
        <div className="plot-wrapper">
          <Plot
            data={polarTraces.length > 0 ? polarTraces : [{
              type: "scatterpolar",
              r: [0],
              theta: [0],
              mode: "markers",
              marker: { size: 0 },
              showlegend: false,
              hoverinfo: "none"
            }]}
            layout={{
              title: canShowData ? "Polar Viewer - All Periods" : "Select channels to start",
              polar: {
                domain: { x: [0, 1], y: [0, 1] },
                radialaxis: {
                  title: "Amplitude",
                  gridcolor: "#444",
                  gridwidth: 1,
                },
                angularaxis: {
                  gridcolor: "#444",
                  gridwidth: 1,
                  rotation: 90,
                  direction: "clockwise",
                  tickmode: "array",
                  tickvals: [0, 90, 180, 270, 360],
                  ticktext: ["0°", "90°", "180°", "270°", "360°"],
                },
              },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "white" },
              showlegend: polarTraces.length > 0,
              legend: {
                orientation: "h",
                y: -0.15,
                x: 0.5,
                xanchor: "center",
                font: { color: "white", size: 10 },
                bgcolor: "rgba(0,0,0,0.5)",
              },
              margin: { t: 40, b: 60, l: 40, r: 40 },
              dragmode: "pan",
              hovermode: "closest",
            }}
            config={{
              responsive: true,
              scrollZoom: true,
              displayModeBar: true,
              doubleClick: 'reset',
            }}
            style={{ width: "100%", height: "450px" }}
          />
        </div>
      </div>
    </div>
  );
}