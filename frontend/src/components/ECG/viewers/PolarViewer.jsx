import { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";

const defaultColors = ["#FF4136", "#0074D9", "#2ECC40", "#FF851B", "#B10DC9", "#FFDC00"];

export default function PolarViewer({ data }) {
  const safeData = data || {
    time: Array(300).fill(0).map((_, i) => i),
    signals: {},
    channels: [],
  };

  const { time, signals: origSignals, channels: origChannels } = safeData;

  const [extraSignals, setExtraSignals] = useState({});
  const [extraChannels, setExtraChannels] = useState([]);
  const allSignals = { ...origSignals, ...extraSignals };
  const allChannels = [...origChannels, ...extraChannels];

  const [visibleChannels, setVisibleChannels] = useState([]);
  const [colors, setColors] = useState({});
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedOption, setSpeedOption] = useState(1);

  const [showCombinationUI, setShowCombinationUI] = useState(false);
  const [selectedForCombination, setSelectedForCombination] = useState([]);

  const requestRef = useRef();

  // Initialize channels
  useEffect(() => {
    setVisibleChannels(origChannels);
    setColors(
      Object.fromEntries(
        origChannels.map((ch, i) => [ch, defaultColors[i % defaultColors.length]])
      )
    );
    setExtraSignals({});
    setExtraChannels([]);
    setIndex(0);
    setIsPlaying(false);
  }, [origChannels]);

  // 🎯 Animation (Point by Point)
  useEffect(() => {
    const animate = () => {
      setIndex((prev) => {
        if (prev >= time.length) {
          setIsPlaying(false);
          return prev;
        }
        return prev + speedOption;
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, speedOption, time.length]);

  // Combination logic
  const toggleSelectForCombination = (ch) => {
    setSelectedForCombination((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  const createCombination = () => {
    if (selectedForCombination.length === 0) return;

    const comboName = "comb_" + selectedForCombination.join("+");
    const comboSignal = Array(time.length).fill(0);

    selectedForCombination.forEach((ch) => {
      for (let i = 0; i < time.length; i++) {
        comboSignal[i] += allSignals[ch]?.[i] || 0;
      }
    });

    setExtraSignals((prev) => ({ ...prev, [comboName]: comboSignal }));
    setExtraChannels((prev) => [...prev, comboName]);
    setVisibleChannels((prev) => [...prev, comboName]);
    setColors((prev) => ({ ...prev, [comboName]: "#FF00FF" }));

    setSelectedForCombination([]);
    setShowCombinationUI(false);
  };

  // θ ثابت 0 → 360 على كامل السيجنال
  const theta =
    time.length > 1
      ? time.map((_, i) => (i / (time.length - 1)) * 360)
      : [];

  const traces =
    visibleChannels.length > 0
      ? visibleChannels.map((ch) => ({
          r: allSignals[ch]?.slice(0, index) || [],
          theta: theta.slice(0, index),
          type: "scatterpolar",
          mode: "lines",
          name: ch,
          line: { color: colors[ch] || "#000", width: 2 },
        }))
      : [
          {
            r: [],
            theta: [],
            type: "scatterpolar",
            mode: "lines",
            name: "No Data",
          },
        ];

  return (
    <div style={{ display: "flex", gap: 20, padding: 20 }}>
      {/* Sidebar */}
      <div style={{ width: 220 }}>
        <h3>Channels</h3>

        {allChannels.map((ch) => (
          <div key={ch}>
            <input
              type="checkbox"
              checked={visibleChannels.includes(ch)}
              onChange={() =>
                setVisibleChannels((prev) =>
                  prev.includes(ch)
                    ? prev.filter((c) => c !== ch)
                    : [...prev, ch]
                )
              }
            />
            <span style={{ marginLeft: 5 }}>{ch}</span>
          </div>
        ))}

        <hr />

        <button onClick={() => setShowCombinationUI(!showCombinationUI)}>
          Create Combination
        </button>

        {showCombinationUI && (
          <div>
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
            <button onClick={createCombination}>Combine</button>
          </div>
        )}

        <hr />

        <button onClick={() => setIsPlaying(!isPlaying)}>
          {isPlaying ? "Pause" : "Play"}
        </button>

        <button
          onClick={() => {
            setIndex(0);
            setIsPlaying(false);
          }}
        >
          Restart
        </button>

        <p>Speed: {speedOption}x</p>
        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={speedOption}
          onChange={(e) => setSpeedOption(Number(e.target.value))}
        />
      </div>

      {/* Polar Plot */}
      <div style={{ flex: 1 }}>
        <Plot
          data={traces}
          layout={{
            title: "Polar Viewer (Point-by-Point)",
            polar: {
              radialaxis: { title: "Amplitude" },
              angularaxis: { direction: "clockwise" },
            },
            margin: { t: 50, b: 50, l: 50, r: 50 },
          }}
          config={{ responsive: true }}
          style={{ width: "100%", height: "600px" }}
        />
      </div>
    </div>
  );
}