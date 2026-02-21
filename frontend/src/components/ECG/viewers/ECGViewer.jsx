import { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";

// Default colors
const defaultColors = ["#FF4136", "#0074D9", "#2ECC40", "#FF851B", "#B10DC9", "#FFDC00"];

export default function ECGViewer({ data }) {
  const safeData = data || { time: [], signals: {}, channels: [] };
  const { time, signals: origSignals, channels: origChannels } = safeData;

  const [extraSignals, setExtraSignals] = useState({});
  const [extraChannels, setExtraChannels] = useState([]);
  
  const allSignals = { ...origSignals, ...extraSignals };
  const allChannels = [...origChannels, ...extraChannels];

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedOption, setSpeedOption] = useState(1);

  const [visibleChannels, setVisibleChannels] = useState([]);
  const [colors, setColors] = useState({});

  const [showCombinationUI, setShowCombinationUI] = useState(false);
  const [selectedForCombination, setSelectedForCombination] = useState([]);

  const windowSize = Math.min(400, time.length);
  const requestRef = useRef();


  useEffect(() => {
    if (origChannels && origChannels.length > 0) {
      setVisibleChannels(origChannels);
      setColors(Object.fromEntries(origChannels.map((ch, i) => [
        ch, 
        defaultColors[i % defaultColors.length]
      ])));
    } else {
      setVisibleChannels([]);
      setColors({});
    }
    
    
    setExtraSignals({});
    setExtraChannels([]);
    setIndex(0);
    setIsPlaying(false);
  }, [origChannels]); 

  const toggleChannel = (ch) => {
    setVisibleChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  useEffect(() => {
    const animate = () => {
      setIndex(prev => {
        const next = prev + speedOption;
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
  }, [isPlaying, speedOption, time.length, windowSize]);

  // Combination functions
  const toggleSelectForCombination = (ch) => {
    setSelectedForCombination(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

  const createCombination = () => {
    if (selectedForCombination.length === 0) return alert("Select at least one channel");

    let comboName = "";
    if (selectedForCombination.length === allChannels.length) {
      comboName = "Combination";
    } else {
      comboName = "comb_" + selectedForCombination.join("+");
    }

    const comboSignal = Array(time.length).fill(0);
    selectedForCombination.forEach(ch => {
      for (let i = 0; i < time.length; i++) {
        comboSignal[i] += (allSignals[ch] ? allSignals[ch][i] : 0);
      }
    });

    setExtraSignals(prev => ({ ...prev, [comboName]: comboSignal }));
    setExtraChannels(prev => [...prev, comboName]);
    setVisibleChannels(prev => [...prev, comboName]);
    setColors(prev => ({ ...prev, [comboName]: "#FF00FF" }));
    setSelectedForCombination([]);
    setShowCombinationUI(false);
  };

  const visibleTime = time.slice(index, index + windowSize);
  const traces = visibleChannels.map(ch => ({
    x: visibleTime,
    y: allSignals[ch]?.slice(index, index + windowSize) || [],
    type: "scatter",
    mode: "lines",
    name: ch,
    line: { color: colors[ch], width: 2 }
  }));

  return (
    <div style={{ display: "flex", gap: 20, padding: 20 }}>
      <div style={{ width: 220, borderRight: "1px solid #ccc", paddingRight: 10 }}>
        <h3>Channels</h3>

        {allChannels.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <button onClick={() => setVisibleChannels([...allChannels])} style={{ marginRight: 5, padding: "4px 8px", cursor: "pointer" }}>Select All</button>
            <button onClick={() => setVisibleChannels([])} style={{ padding: "4px 8px", cursor: "pointer" }}>Clear All</button>
          </div>
        )}

        {allChannels.map(ch => (
          <div key={ch} style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <input type="checkbox" checked={visibleChannels.includes(ch)} onChange={() => toggleChannel(ch)} />
            <span style={{ marginLeft: 5, marginRight: 5 }}>{ch}</span>
            <input type="color" value={colors[ch] || "#000000"} onChange={e => setColors({ ...colors, [ch]: e.target.value })} style={{ width: 25, height: 25, border: "none", cursor: "pointer" }} />
          </div>
        ))}

        <hr style={{ margin: "10px 0" }} />

        <button onClick={() => setShowCombinationUI(!showCombinationUI)} style={{ width: "100%", padding: "6px", marginBottom: 5, cursor: "pointer" }}>
          Create Combination
        </button>

        {showCombinationUI && (
          <div style={{ border: "1px solid #ccc", padding: 8, marginBottom: 8, maxHeight: 200, overflowY: "auto" }}>
            <h4>Select Channels:</h4>
            <button onClick={() => setSelectedForCombination([...allChannels])} style={{ marginRight: 5 }}>Select All</button>
            <button onClick={() => setSelectedForCombination([])}>Clear All</button>
            {allChannels.map(ch => (
              <div key={ch}>
                <input type="checkbox" checked={selectedForCombination.includes(ch)} onChange={() => toggleSelectForCombination(ch)} />
                <span style={{ marginLeft: 5 }}>{ch}</span>
              </div>
            ))}
            <button onClick={createCombination} style={{ marginTop: 5, width: "100%", padding: 4, cursor: "pointer" }}>Combine Selected</button>
          </div>
        )}

        <hr style={{ margin: "10px 0" }} />

        <button 
          onClick={() => setIsPlaying(!isPlaying)} 
          style={{ width: "100%", padding: "8px", marginBottom: 5, backgroundColor: isPlaying ? "#FF4136" : "#2ECC40", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button 
          onClick={() => { setIndex(0); setIsPlaying(false); }} 
          style={{ width: "100%", padding: "8px", marginBottom: 5, cursor: "pointer" }}>
          Restart 
        </button>

        <p style={{ marginTop: 10 }}>Speed: {speedOption}x</p>
        <select value={speedOption} onChange={e => setSpeedOption(Number(e.target.value))} style={{ width: "100%", marginBottom: 5 }}>
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
        <input type="range" min="0.5" max="4" step="0.1" value={speedOption} onChange={e => setSpeedOption(Number(e.target.value))} style={{ width: "100%" }} />
      </div>

      <div style={{ flex: 1 }}>
        <p>Timeline Progress</p>
        <input
          type="range"
          min="0"
          max={Math.max(0, time.length - windowSize)}
          value={index}
          onChange={e => setIndex(Number(e.target.value))}
          style={{ width: "100%", marginBottom: 10 }}
        />
        <Plot
          data={traces}
          layout={{
            title: "ECG Viewer",
            xaxis: { title: "Time (s)", gridcolor: "#eee" },
            yaxis: { title: "Amplitude", gridcolor: "#eee" },
            dragmode: "pan",
            margin: { t: 50, b: 50, l: 50, r: 20 },
            paper_bgcolor: "white",
            plot_bgcolor: "white",
            legend: { orientation: "h", y: -0.2 }
          }}
          config={{ responsive: true, scrollZoom: true }}
          style={{ width: "100%", height: "500px" }}
        />
      </div>
    </div>
  );
}