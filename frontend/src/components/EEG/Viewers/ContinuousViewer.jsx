import React, { useState, useEffect, useRef, useCallback } from 'react';
import Plot from 'react-plotly.js';
import '../../../styles/eeg/Viewers/ContinuousViewer.css';

const ContinuousViewer = ({ fileId, metadata, mlPredictions, dlPredictions }) => {
  // --- STATE MANAGEMENT ---
  const [dataBuffer, setDataBuffer] = useState({ time: [] });
  const [nextPageToFetch, setNextPageToFetch] = useState(1);
  const [isFetching, setIsFetching] = useState(false);
  
  // Playback & Viewport State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const windowSize = 2.0; // Show 2 seconds of data at a time
  const [xRange, setXRange] = useState([0, windowSize]);
  
  // View Modes: 'single' (stacked with offset), 'volts' (overlay no offset), or 'multiple' (N small viewers)
  const [viewMode, setViewMode] = useState('single');

  // Channel Settings (Visibility, Color, Thickness)
  const [channelSettings, setChannelSettings] = useState({});

  // Refs for intervals, calculations, and our fetch lock
  const playIntervalRef = useRef(null);
  const dataLimit = 1000; 
  
  // 1. ADDED REF: This acts as a memory of what we have already asked for
  const fetchedPages = useRef(new Set()); 

  // --- INITIALIZATION ---
  useEffect(() => {
    if (metadata && metadata.features && metadata.features.channels) {
      const initialSettings = {};
      const colors = ['#64b5f6', '#81c784', '#e57373', '#ffb74d', '#ba68c8', '#4db6ac', '#a1887f', '#90a4ae'];

      metadata.features.channels.forEach((ch, index) => {
        initialSettings[ch] = {
          visible: true,
          color: colors[index % colors.length],
          thickness: 1.5
        };
        setDataBuffer(prev => ({ ...prev, [ch]: [] }));
      });
      setChannelSettings(initialSettings);
    }
  }, [metadata]);

  // --- BACKGROUND DATA FETCHING (FIXED WITH LOCK) ---
  const fetchNextChunk = useCallback(async () => {
    // GUARD 1: If no file or already busy, stop.
    if (!fileId || isFetching) return;

    // GUARD 2: THE FIX. If we already fetched this page number, STOP.
    if (fetchedPages.current.has(nextPageToFetch)) {
        return; 
    }

    // Lock this page so we don't fetch it again
    fetchedPages.current.add(nextPageToFetch);
    setIsFetching(true);

    try {
      const response = await fetch(`http://127.0.0.1:8000/EEG/data/${fileId}?page=${nextPageToFetch}&limit=${dataLimit}`);
      
      if (!response.ok) {
        // If it failed, unlock the page so we can try again later
        fetchedPages.current.delete(nextPageToFetch);
        console.error("API Error:", response.statusText);
        return;
      }

      const newData = await response.json();

      if (newData.time && newData.time.length > 0) {
        setDataBuffer(prev => {
          // --- DUPLICATE REMOVAL LOGIC ---
          // Even if the page is new, check if the timestamps overlap with what we have
          const lastCurrentTime = prev.time.length > 0 ? prev.time[prev.time.length - 1] : -1;
          
          let startIndex = -1;
          for (let i = 0; i < newData.time.length; i++) {
            if (newData.time[i] > lastCurrentTime) {
              startIndex = i;
              break;
            }
          }

          // If all data is old, return previous state
          if (startIndex === -1) return prev;

          // Only add the fresh data
          const updatedBuffer = { ...prev };
          const validTimeSlice = newData.time.slice(startIndex);
          updatedBuffer.time = [...(prev.time || []), ...validTimeSlice];

          if (newData.signals) {
              Object.keys(newData.signals).forEach(channelName => {
                  const prevSignalData = prev[channelName] || [];
                  const newSignalData = newData.signals[channelName];
                  
                  // Slice the signal array using the same index
                  updatedBuffer[channelName] = [...prevSignalData, ...newSignalData.slice(startIndex)];
              });
          }
          return updatedBuffer;
        });

        // Safely increment page
        setNextPageToFetch(prev => prev + 1);
      }
    } catch (error) {
      console.error("Failed to fetch chunk:", error);
      fetchedPages.current.delete(nextPageToFetch); // Unlock on error
    } finally {
      setIsFetching(false);
    }

  }, [fileId, nextPageToFetch, isFetching]);

  // --- INITIAL LOAD ---
  useEffect(() => {
    // Reset the "memory" when a new file is loaded
    fetchedPages.current.clear();
    setNextPageToFetch(1);
  }, [fileId]);

  useEffect(() => {
    // Start fetching Page 1
    if (nextPageToFetch === 1) {
        fetchNextChunk();
    }
  }, [nextPageToFetch, fetchNextChunk]);

  // Continues to buffer ahead dynamically
  useEffect(() => {
    const maxLoadedTime = dataBuffer.time[dataBuffer.time.length - 1] || 0;
    if (xRange[1] > maxLoadedTime - 1.0 && maxLoadedTime > 0) {
      fetchNextChunk();
    }
  }, [xRange, dataBuffer.time, fetchNextChunk]);


  // --- PLAYBACK LOGIC ---
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setXRange(prev => {
          const step = 0.05 * playbackSpeed; 
          const maxLoadedTime = dataBuffer.time[dataBuffer.time.length - 1] || 0;
          
          if (prev[1] + step >= maxLoadedTime && !isFetching) {
            setIsPlaying(false);
            return prev;
          }
          return [prev[0] + step, prev[1] + step];
        });
      }, 50); 
    } else {
      clearInterval(playIntervalRef.current);
    }
    return () => clearInterval(playIntervalRef.current);
  }, [isPlaying, playbackSpeed, dataBuffer.time, isFetching]);

  // --- HANDLERS ---
  const handleZoom = (direction) => {
    const rangeSize = xRange[1] - xRange[0];
    const zoomFactor = direction === 'in' ? 0.8 : 1.25;
    const newSize = rangeSize * zoomFactor;
    const center = xRange[0] + rangeSize / 2;
    setXRange([Math.max(0, center - newSize / 2), center + newSize / 2]);
  };

  const handlePan = (direction) => {
    const rangeSize = xRange[1] - xRange[0];
    const shift = rangeSize * 0.2 * (direction === 'left' ? -1 : 1);
    setXRange([Math.max(0, xRange[0] + shift), Math.max(rangeSize, xRange[1] + shift)]);
  };

  const handleSliderChange = (e) => {
    const newStart = Number(e.target.value);
    setXRange([newStart, newStart + windowSize]);
  };

  const updateChannelSetting = (ch, key, value) => {
    setChannelSettings(prev => ({
      ...prev,
      [ch]: { ...prev[ch], [key]: value }
    }));
  };

  const toggleAllChannels = (isVisible) => {
    setChannelSettings(prev => {
      const newSettings = { ...prev };
      Object.keys(newSettings).forEach(ch => {
        newSettings[ch].visible = isVisible;
      });
      return newSettings;
    });
  };

  // Check if all channels are currently visible to control the master checkbox state
  const allChannelsVisible = Object.values(channelSettings).every(ch => ch.visible);
  const maxTimeLoaded = dataBuffer.time[dataBuffer.time.length - 1] || windowSize;

  // Helper to safely format predictions
  const formatPrediction = (pred) => {
    if (!pred) return "N/A";
    if (typeof pred === 'object') return JSON.stringify(pred);
    return pred;
  };

  // --- PLOT RENDERERS ---
  const renderLargeViewer = (isStacked) => {
    // 1. Get list of visible channels
    const visibleChannels = Object.keys(channelSettings).filter(ch => channelSettings[ch].visible);
    
    // 2. Define the vertical spacing (gap) between signals for Single mode
    const spacing = 100;

    // 3. Create Traces with strict length matching to prevent linear line artifacts
    const traces = visibleChannels.map((ch, index) => {
      const offset = isStacked ? (index * spacing) : 0;
      const yData = dataBuffer[ch] || [];
      // STRICT FIX: Slice the time array to exactly match the length of the channel's data
      const xData = (dataBuffer.time || []).slice(0, yData.length);

      return {
        x: xData,
        y: isStacked ? yData.map(v => v + offset) : yData, 
        type: 'scatter',
        mode: 'lines',
        name: ch,
        line: { color: channelSettings[ch].color, width: channelSettings[ch].thickness },
        hoverinfo: 'name+y' 
      };
    });

    // 4. Configure Y-Axis based on mode
    const yAxisConfig = isStacked ? {
      title: '', 
      showgrid: true, 
      gridcolor: 'rgba(28, 110, 160, 0.1)',
      zeroline: false,
      tickmode: 'array',
      tickvals: visibleChannels.map((_, index) => index * spacing),
      ticktext: visibleChannels
    } : {
      title: 'Amplitude (Volts)', 
      showgrid: true, 
      gridcolor: 'rgba(28, 110, 160, 0.2)',
      zeroline: true,
      zerolinecolor: 'rgba(28, 110, 160, 0.6)'
    };

    return (
      <Plot
        data={traces}
        layout={{
          autosize: true,
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { color: '#b9d2e2' },
          xaxis: { 
            range: xRange, 
            title: 'Time (s)', 
            showgrid: true, 
            gridcolor: 'rgba(28, 110, 160, 0.2)' 
          },
          yaxis: yAxisConfig,
          margin: { l: 80, r: 20, t: 30, b: 40 },
          showlegend: false,
          hovermode: 'closest'
        }}
        useResizeHandler={true}
        style={{ width: '100%', height: '100%' }}
        config={{ displayModeBar: false }}
        onRelayout={(e) => {
          if (e['xaxis.range[0]'] !== undefined) {
            setXRange([e['xaxis.range[0]'], e['xaxis.range[1]']]);
          }
        }}
      />
    );
  };

  const renderMultipleSmallViewers = () => {
    const visibleChannels = Object.keys(channelSettings).filter(ch => channelSettings[ch].visible);
    
    return (
      <div className="multiple-viewers-container">
        {visibleChannels.map(ch => {
          const yData = dataBuffer[ch] || [];
          const xData = (dataBuffer.time || []).slice(0, yData.length);

          return (
            <div key={ch} className="small-viewer">
              <h4 className="small-viewer-title">{ch}</h4>
              <Plot
                data={[{
                  x: xData,
                  y: yData,
                  type: 'scatter',
                  mode: 'lines',
                  line: { color: channelSettings[ch].color, width: channelSettings[ch].thickness },
                  hoverinfo: 'none'
                }]}
                layout={{
                  autosize: true,
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: '#b9d2e2' },
                  xaxis: { range: xRange, showgrid: true, gridcolor: 'rgba(28, 110, 160, 0.2)' },
                  yaxis: { showgrid: true, gridcolor: 'rgba(28, 110, 160, 0.2)' },
                  margin: { l: 40, r: 10, t: 10, b: 25 }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '150px' }}
                config={{ displayModeBar: false }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="continuous-viewer-layout">
      
      {/* LEFT AREA: MAIN CONTENT */}
      <div className="viewer-main-area">
        
        {/* TOP CONTROL PANEL (FLAT) */}
        <div className="top-control-panel">
          <button className={`ctrl-btn ${isPlaying ? 'active-play' : ''}`} onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          
          <select className="ctrl-select" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(Number(e.target.value))}>
            <option value={0.5}>0.5x Speed</option>
            <option value={1}>1x Speed</option>
            <option value={2}>2x Speed</option>
            <option value={4}>4x Speed</option>
          </select>

          <button className="ctrl-btn" onClick={() => handlePan('left')}>← Pan</button>
          <button className="ctrl-btn" onClick={() => handlePan('right')}>Pan →</button>
          <button className="ctrl-btn" onClick={() => handleZoom('out')}>- Zoom</button>
          <button className="ctrl-btn" onClick={() => handleZoom('in')}>+ Zoom</button>

          <button className={`ctrl-btn ${viewMode === 'single' ? 'active-mode' : ''}`} onClick={() => setViewMode('single')}>
            Single
          </button>
          <button className={`ctrl-btn ${viewMode === 'volts' ? 'active-mode' : ''}`} onClick={() => setViewMode('volts')}>
            Volts
          </button>
          <button className={`ctrl-btn ${viewMode === 'multiple' ? 'active-mode' : ''}`} onClick={() => setViewMode('multiple')}>
            Multi
          </button>
        </div>

        {/* PREDICTIONS NAVBAR (NEW CLASSES APPLIED) */}
        <div className="prediction-navbar">
          <div className="prediction-item">
            <span className="prediction-label ml">ML Prediction:</span>
            <span className="prediction-value">{formatPrediction(mlPredictions)}</span>
          </div>
          <div className="prediction-item">
            <span className="prediction-label dl">DL Prediction:</span>
            <span className="prediction-value">{formatPrediction(dlPredictions)}</span>
          </div>
        </div>

        {/* GRAPH VIEWPORT */}
        <div className="graph-viewport">
          {viewMode === 'single' && renderLargeViewer(true)}
          {viewMode === 'volts' && renderLargeViewer(false)}
          {viewMode === 'multiple' && renderMultipleSmallViewers()}
        </div>

        {/* BOTTOM SLIDER PANEL (SLIM HEIGHT) */}
        <div className="bottom-slider-panel">
          <span className="slider-label">Timeline:</span>
          <input 
            type="range" 
            className="time-slider"
            min="0" 
            max={Math.max(0, maxTimeLoaded - windowSize)} 
            step="0.1" 
            value={xRange[0]} 
            onChange={handleSliderChange} 
          />
        </div>

      </div>

      {/* RIGHT AREA: CHANNEL SETTINGS PANEL */}
      <div className="right-settings-panel">
        <h3 className="panel-title">Channels</h3>
        
        {/* MASTER TOGGLE */}
        <div className="master-toggle-container">
          <label className="ch-toggle master-toggle">
            <input 
              type="checkbox" 
              checked={allChannelsVisible}
              onChange={(e) => toggleAllChannels(e.target.checked)}
            />
            <span>Toggle All Channels</span>
          </label>
        </div>

        <div className="channels-list">
          {Object.keys(channelSettings).map(ch => (
            <div key={ch} className={`channel-card ${!channelSettings[ch].visible ? 'dimmed' : ''}`}>
              
              <div className="channel-header">
                <label className="ch-toggle">
                  <input 
                    type="checkbox" 
                    checked={channelSettings[ch].visible}
                    onChange={(e) => updateChannelSetting(ch, 'visible', e.target.checked)}
                  />
                  <span>{ch}</span>
                </label>
              </div>

              {channelSettings[ch].visible && (
                <div className="channel-controls">
                  <div className="ctrl-row">
                    <span>Color:</span>
                    <input 
                      type="color" 
                      value={channelSettings[ch].color}
                      onChange={(e) => updateChannelSetting(ch, 'color', e.target.value)}
                    />
                  </div>
                  <div className="ctrl-row">
                    <span>Width:</span>
                    <input 
                      type="range" 
                      min="0.5" max="5" step="0.5"
                      value={channelSettings[ch].thickness}
                      onChange={(e) => updateChannelSetting(ch, 'thickness', Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
};

export default ContinuousViewer;