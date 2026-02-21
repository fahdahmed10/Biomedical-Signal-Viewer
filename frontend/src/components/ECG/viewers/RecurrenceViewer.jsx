// Cross-channel scatter plot
import { useState, useEffect, useMemo } from "react";
import Plot from "react-plotly.js";

export default function RecurrenceViewer({ data }) {

  const safeData = data || { time: [], signals: {}, channels: [] };
  const { time = [], signals: origSignals = {}, channels: origChannels = [] } = safeData;

  const [signals, setSignals] = useState({});
  const [channels, setChannels] = useState([]);

  const [xChannel, setXChannel] = useState("");
  const [yChannel, setYChannel] = useState("");

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Reset when data changes
  useEffect(() => {
    if (!data) return;

    setSignals({ ...origSignals });
    setChannels([...origChannels]);
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

  // Safe range calculation
  const getRange = arr => {
    if (!arr || arr.length === 0) return [-1, 1];

    let min = arr[0];
    let max = arr[0];

    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < min) min = arr[i];
      if (arr[i] > max) max = arr[i];
    }

    const padding = (max - min) * 0.1 || 0.5;
    return [min - padding, max + padding];
  };

  const xRange = useMemo(() => getRange(signals[xChannel]), [signals, xChannel]);
  const yRange = useMemo(() => getRange(signals[yChannel]), [signals, yChannel]);

  const xData = signals[xChannel]?.slice(0, index) || [];
  const yData = signals[yChannel]?.slice(0, index) || [];

  // Color bins for animation
  const binSize = 0.2;
  const timeSlice = time.slice(0, index).map(t => Math.floor(t / binSize));
  const dynamicMax = timeSlice.length > 0 ? Math.max(...timeSlice) : 1;

  const handleReset = () => {
    setIndex(0);
    setIsPlaying(false);
  };

  const showPlaceholder = !data || channels.length < 2;

  return (
    <div style={{ display: "flex", gap: 20, padding: 20, width: "100%" }}>

      {/* Controls */}
      <div style={{ width: 250, borderRight: "1px solid #ccc", paddingRight: 10 }}>
        <h3>Recurrence Viewer</h3>

        <p style={{ color: "#888", fontSize: 12 }}>
          {showPlaceholder ? "Upload ECG data to start." : "Data Loaded ✔"}
        </p>

        <label>X Axis:</label>
        <select
          value={xChannel}
          onChange={e => setXChannel(e.target.value)}
          disabled={showPlaceholder}
          style={{ width: "100%", marginBottom: 10 }}
        >
          {channels.length > 0
            ? channels.map(ch => <option key={ch} value={ch}>{ch}</option>)
            : <option>No Channels</option>}
        </select>

        <label>Y Axis:</label>
        <select
          value={yChannel}
          onChange={e => setYChannel(e.target.value)}
          disabled={showPlaceholder}
          style={{ width: "100%", marginBottom: 10 }}
        >
          {channels.length > 0
            ? channels.map(ch => <option key={ch} value={ch}>{ch}</option>)
            : <option>No Channels</option>}
        </select>

        <hr />

        <button
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={showPlaceholder}
          style={{ width: "100%", marginBottom: 5 }}
        >
          {isPlaying ? "Pause" : "Start"}
        </button>

        <button
          onClick={handleReset}
          disabled={showPlaceholder}
          style={{ width: "100%", marginBottom: 10 }}
        >
          Reset Animation
        </button>

        <p>Speed: {speed}</p>
        <input
          type="range"
          min="1"
          max="10"
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          disabled={showPlaceholder}
          style={{ width: "100%" }}
        />
      </div>

      {/* Plot */}
      <div style={{ flex: 1, width: "100%", height: "500px" }}>
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
              fixedrange: false
            },
            yaxis: {
              title: showPlaceholder ? "Y" : yChannel,
              range: showPlaceholder ? [-1, 1] : yRange,
              autorange: false,
              fixedrange: false
            }
          }}
        />
      </div>
    </div>
  );
}