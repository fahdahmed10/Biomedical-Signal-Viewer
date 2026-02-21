import { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";

export default function XORViewer({ data }) {
  const safeData = data || { time: [], signals: {}, channels: [] };
  const { time, signals: origSignals, channels: origChannels } = safeData;

  const [visibleChannel, setVisibleChannel] = useState(origChannels[0] || null);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const windowSize = Math.min(400, time.length || 400);
  const requestRef = useRef();

  useEffect(() => {
    setVisibleChannel(origChannels[0] || null);
    setIndex(0);
    setIsPlaying(false);
  }, [data]);

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

  useEffect(() => {
    if (isPlaying && time.length > 0) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, speed, time]);

  if (!visibleChannel || time.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <h2>XOR Viewer</h2>
        <p>No data loaded</p>
      </div>
    );
  }

  const currentChunk = origSignals[visibleChannel]?.slice(index, index + windowSize) || [];
  const previousChunk = origSignals[visibleChannel]?.slice(
    Math.max(0, index - windowSize),
    index
  ) || [];

  const diff = currentChunk.map((val, i) => {
    const prevVal = previousChunk[i] || 0;
    return val - prevVal;
  });

  const visibleTime = time.slice(index, index + windowSize);

  const traces = [
    {
      x: visibleTime,
      y: currentChunk,
      type: "scatter",
      mode: "lines",
      name: "Current",
    },
    {
      x: visibleTime,
      y: diff,
      type: "scatter",
      mode: "lines",
      name: "XOR (Difference)",
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <h2>XOR Viewer</h2>

      {origChannels.length > 0 && (
        <select
          value={visibleChannel}
          onChange={e => setVisibleChannel(e.target.value)}
          style={{ marginBottom: 10 }}
        >
          {origChannels.map(ch => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>
      )}

      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={() => { setIndex(0); setIsPlaying(false); }}>
          Restart
        </button>
      </div>

      <Plot
        data={traces}
        layout={{
          title: "XOR Viewer",
          xaxis: { title: "Time" },
          yaxis: { title: "Amplitude" },
          margin: { t: 40, l: 40, r: 20, b: 40 },
        }}
        config={{ responsive: true }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
}