import { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";

const defaultColors = ["#FF4136", "#0074D9", "#2ECC40", "#FF851B", "#B10DC9", "#FFDC00"];

export default function ECGViewer({ data }) {
  const safeData = data || { time: [], signals: {}, channels: [] };
  // Destructuring
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
  // useRef = hidden box that keeps value between renders without updating UI
  const requestRef = useRef();
  const maxIndex = Math.max(0, time.length - windowSize);

  //channels & Channels
  useEffect(() => {
    if (origChannels && origChannels.length > 0) {
      setVisibleChannels(origChannels);
     // ["ch1", "red"],["ch2", "blue"],["ch3", "#green"] 
     // convert array to object
      setColors(
        Object.fromEntries(
          origChannels.map((ch, i) => [
            ch,
            defaultColors[i % defaultColors.length]
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


  useEffect(() => {
    if (index > maxIndex) {
      setIndex(maxIndex);
    }
  }, [index, maxIndex]);


//checkbox
  const toggleChannel = (ch) => {
    setVisibleChannels(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };

//Animation Engine
  useEffect(() => {
    const animate = () => {
      setIndex(prev => {
        const next = prev + speedOption;
        if (next >= maxIndex) {
          setIsPlaying(false);
          return maxIndex;
        }
        return next;
      });
      requestRef.current = requestAnimationFrame(animate); 
    };

    if (isPlaying && time.length > 0 && maxIndex > 0) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(requestRef.current);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, [isPlaying, speedOption, maxIndex, time.length]);

  const toggleSelectForCombination = (ch) => {
    setSelectedForCombination(prev =>
      prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
    );
  };



  const createCombination = () => {
    if (selectedForCombination.length === 0)
      return alert("Select at least One channel");

    let comboName =
      selectedForCombination.length === allChannels.length
        ? "Average (All)"
        : "Avg_" + selectedForCombination.join("+");

    const comboSignal = Array(time.length).fill(0);

    selectedForCombination.forEach(ch => {
      for (let i = 0; i < time.length; i++) {
        comboSignal[i] += allSignals[ch]?.[i] || 0;
      }
    });

    for (let i = 0; i < time.length; i++) {
      comboSignal[i] = comboSignal[i] / selectedForCombination.length;
    }

    setExtraSignals(prev => ({ ...prev, [comboName]: comboSignal }));
    setExtraChannels(prev => [...prev, comboName]);
    //automatically display the new combined channel on the graph
    setVisibleChannels(prev => [...prev, comboName]);
    setColors(prev => ({ ...prev, [comboName]: "#FF00FF" }));

    setSelectedForCombination([]);
    setShowCombinationUI(false);
  };

//take a slice of the time array based on the current index and window size
  const visibleTime = time.slice(index, index + windowSize);

  //gragh details
  const traces = visibleChannels.map(ch => ({
    x: visibleTime,
    y: allSignals[ch]?.slice(index, index + windowSize) || [],
    type: "scatter",
    mode: "lines",
    name: ch,
    line: { color: colors[ch], width: ch.startsWith("Avg") ? 3 : 2 },
    opacity: ch.startsWith("Avg") ? 1 : 0.8
  }));


  
  return (
    <div className="viewer-container">
      <div className="controls-panel">
        <h3>ECG Viewer Controls</h3>

        {/*select clear buttons*/}
        {allChannels.length > 0 && (
          <div className="button-group">
            <button className="ecg-btn-primary" onClick={() => setVisibleChannels([...allChannels])}>
              Select All
            </button>
            <button className="ecg-btn" onClick={() => setVisibleChannels([])}>
              Clear All
            </button>
          </div>
        )}

        {/* checkbox */}
        {allChannels.map(ch => (
          <div key={ch} className="channel-row" data-many-channels={allChannels.length > 8 ? "true" : "false"}>
            <input
              type="checkbox"
              checked={visibleChannels.includes(ch)}
              onChange={() => toggleChannel(ch)}
            />
            <span title={ch}>{ch}</span>
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
              <div key={ch} className="combination-item">
                <input
                  type="checkbox"
                  checked={selectedForCombination.includes(ch)}
                  onChange={() => toggleSelectForCombination(ch)}
                />
                <span>{ch}</span>
              </div>
            ))}

            <button className="ecg-btn-success" onClick={createCombination}>
              Average Selected ({selectedForCombination.length} channel{selectedForCombination.length !== 1 ? 's' : ''})
            </button>
          </div>
        )}

        <hr className="section-divider" />


        {/* Play button */}
        <button
          className={`ecg-btn ${isPlaying ? "ecg-btn-danger" : "ecg-btn-success"}`}
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={time.length === 0}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>


        <button
          className="ecg-btn"
          onClick={() => {
            setIndex(0);
            setIsPlaying(false);
          }}
          disabled={time.length === 0}
        >
          Restart
        </button>


        <label className="control-label">Speed: {speedOption}x</label>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.5"
          value={speedOption}
          onChange={e => setSpeedOption(Number(e.target.value))}
          className="range-slider"
        />
      </div>
      

      <div className="plot-container">
        {time.length > 0 && (
          <input
            className="full-input plot-timeline"
            type="range"
            min="0"
            max={maxIndex}
            value={index}
            onChange={e => setIndex(Number(e.target.value))}
          />
        )}

        <div className="plot-wrapper">
          <Plot
            data={traces}
            layout={{
              title: time.length > 0 ? "ECG Viewer" : "No Data",
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: { color: "#fff" },
              xaxis: {
                title: "Time (s)",
                gridcolor: "#333",
                zerolinecolor: "#444",
                range: time.length > 0 ? [visibleTime[0], visibleTime[visibleTime.length-1]] : [0, 10]
              },
              yaxis: {
                title: "Amplitude",
                gridcolor: "#333",
                zerolinecolor: "#444"
              },
              dragmode: "pan",
              margin: { t: 50, b: 50, l: 50, r: 20 },
              legend: { orientation: "h", y: -0.2, font: { color: "#fff" } },
              hovermode: "closest"
            }}
            config={{ responsive: true, scrollZoom: true, displayModeBar: false }}
            style={{ width: "100%", height: "450px" }}
          />
        </div>
      </div>
    </div>
  );
}