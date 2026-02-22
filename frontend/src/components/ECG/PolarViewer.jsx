import { useState, useEffect, useRef } from "react";
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
  const safeData = data || { time: [], signals: {}, channels: [] };
  const { time = [], signals: origSignals = {}, channels: origChannels = [] } = safeData;

  const [extraSignals, setExtraSignals] = useState({});
  const [extraChannels, setExtraChannels] = useState([]);

  const allSignals = { ...origSignals, ...extraSignals };
  const allChannels = [...origChannels, ...extraChannels];

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const [visibleChannels, setVisibleChannels] = useState([]);
  const [colors, setColors] = useState({});
  const [period, setPeriod] = useState(1);

  const [showCombinationUI, setShowCombinationUI] = useState(false);
  const [selectedForCombination, setSelectedForCombination] = useState([]);

  const requestRef = useRef(null);

  /* ================= INIT ================= */

  useEffect(() => {
    if (origChannels.length) {
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

  /* ================= ANIMATION ================= */

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
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, speed, time.length]);

  /* ================= HELPERS ================= */

  const toggleChannel = (ch) => {
    setVisibleChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const toggleSelectForCombination = (ch) => {
    setSelectedForCombination((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const createCombination = () => {
    if (!selectedForCombination.length) return;

    const name =
      selectedForCombination.length === allChannels.length
        ? "Combination"
        : "comb_" + selectedForCombination.join("+");

    const comboSignal = Array(time.length).fill(0);

    selectedForCombination.forEach((ch) => {
      for (let i = 0; i < time.length; i++) {
        comboSignal[i] += allSignals[ch]?.[i] || 0;
      }
    });

    setExtraSignals((p) => ({ ...p, [name]: comboSignal }));
    setExtraChannels((p) => [...p, name]);
    setVisibleChannels((p) => [...p, name]);
    setColors((p) => ({ ...p, [name]: "#FF00FF" }));

    setSelectedForCombination([]);
    setShowCombinationUI(false);
  };

  /* ================= POLAR TRACES ================= */

  const traces = [];

  visibleChannels.forEach((ch) => {
    const signal = allSignals[ch] || {};
    const cycles = {};

    for (let i = 0; i <= index; i++) {
      const t = time[i];
      const cycle = Math.floor(t / period);
      const theta = ((t % period) / period) * 360;

      if (!cycles[cycle]) cycles[cycle] = { r: [], theta: [] };

      cycles[cycle].r.push(signal[i]);
      cycles[cycle].theta.push(theta);
    }

    Object.values(cycles).forEach((cycle) => {
      traces.push({
        type: "scatterpolar",
        mode: "lines",
        r: cycle.r,
        theta: cycle.theta,
        name: ch,
        line: { color: colors[ch], width: 2 },
        opacity: 0.4,
      });
    });
  });

  /* ================= RENDER ================= */

  return (
    <div className="viewer-container">

      {/* ===== Sidebar ===== */}
      <div className="controls-panel">
        <h3>Polar Controls</h3>

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

        <button
          className="ecg-btn ecg-btn-primary"
          onClick={() => setShowCombinationUI(!showCombinationUI)}
        >
          Create Combination
        </button>

        {showCombinationUI && (
          <div className="combination-box">
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
              className="ecg-btn ecg-btn-success"
            >
              Combine
            </button>
          </div>
        )}

        <hr />

        <label>Period (sec)</label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          value={period}
          onChange={(e) => setPeriod(+e.target.value)}
          className="full-input"
        />

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
          className="ecg-btn ecg-btn-primary"
        >
          Restart
        </button>

        <label>Speed: {speed}x</label>
        <input
          type="range"
          min="1"
          max="5"
          value={speed}
          onChange={(e) => setSpeed(+e.target.value)}
        />
      </div>

      {/* ===== Plot ===== */}
      <div className="plot-container">
        <label>Timeline Progress</label>
        <input
          type="range"
          min="0"
          max={Math.max(0, time.length - 1)}
          value={index}
          onChange={(e) => setIndex(+e.target.value)}
          className="full-input plot-timeline"
        />

        <div className="plot-wrapper">
          <Plot
            data={traces}
            layout={{
              title: "ECG Polar Phase Overlay",
              polar: {
                radialaxis: { 
                  title: "Amplitude",
                  gridcolor: "#333"
                },
                angularaxis: { 
                  rotation: 90, 
                  direction: "clockwise",
                  gridcolor: "#333"
                },
              },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: "white" },
              legend: { orientation: "h", y: -0.25 },
              margin: { t: 50, b: 50, l: 50, r: 50 }
            }}
            config={{ responsive: true, scrollZoom: true }}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </div>

    </div>
  );
}