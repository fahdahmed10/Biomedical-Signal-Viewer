import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, AreaChart, Area, ScatterChart, Scatter, ReferenceLine
} from 'recharts';
import './microbiome.css';

const API_URL = "http://127.0.0.1:8000";

const CHART_COLORS = ["#1c6ea0", "#4685ac", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#f43f5e", "#eab308", "#64748b"];

const Microbiome = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rawData, setRawData] = useState(null);
  
  // ==========================================
  // VIEW CONTROL STATE (TABS)
  // ==========================================
  // MODIFICATION: Set initial state to null so no graphs appear initially
  const [activeCard, setActiveCard] = useState(null); 

  // ==========================================
  // CHART CONTROL STATES
  // ==========================================
  // 1. Stacked Area Chart (Top 5 Taxa)
  const [activeTaxa, setActiveTaxa] = useState([]);
  
  // 2. Fecalcal Chart Overlay Selection
  const [g2Overlay, setG2Overlay] = useState('shannon'); // 'shannon' or 'healthy_index'

  // 3. Summation Chart & Ratio
  const [g3ShowProSum, setG3ShowProSum] = useState(true);
  const [g3ShowOppSum, setG3ShowOppSum] = useState(true);
  const [g3ShowRatio, setG3ShowRatio] = useState(true);

  // 4. Health Index Profiling (Individual Bacteria Selection)
  const [g4SelectedTaxa, setG4SelectedTaxa] = useState([]);

  // 5. Shannon Profiling (Individual Bacteria Selection)
  const [g5SelectedTaxa, setG5SelectedTaxa] = useState([]);

  // 6. PCA 
  const [pcaPath, setPcaPath] = useState(true);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setRawData(null);
    }
  };

  const handleAnalysis = async () => {
    if (!file) {
      setError("Please select a valid dataset file first.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API_URL}/microbiome`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRawData(response.data);
      // MODIFICATION: Reset view to null when new data is loaded so only the cards show
      setActiveCard(null);
    } catch (err) {
      console.error(err);
      setError("Analysis failed. Ensure the backend is running and the file is a valid microbiome dataset.");
    } finally {
      setLoading(false);
    }
  };

  // Initialize the Area Chart with the top 5 bacteria when data loads
  useEffect(() => {
    if (rawData && rawData.top5_names) {
      setActiveTaxa(rawData.top5_names);
    }
  }, [rawData]);

  const handleToggleTaxa = (taxaName) => {
    setActiveTaxa(prev => 
      prev.includes(taxaName) 
        ? prev.filter(t => t !== taxaName) 
        : [...prev, taxaName]              
    );
  };

  const handleToggleG4Taxa = (taxaName) => {
    setG4SelectedTaxa(prev => 
      prev.includes(taxaName) 
        ? prev.filter(t => t !== taxaName) 
        : [...prev, taxaName]              
    );
  };

  const handleToggleG5Taxa = (taxaName) => {
    setG5SelectedTaxa(prev => 
      prev.includes(taxaName) 
        ? prev.filter(t => t !== taxaName) 
        : [...prev, taxaName]              
    );
  };

  // ==========================================
  // DATA TRANSFORMATION & CLINICAL LOGIC
  // ==========================================
  const { chartData, scatterData, latestMetrics, insights, availableTaxaList, protectiveTaxaList, opportunisticTaxaList } = useMemo(() => {
    if (!rawData || !rawData.weeks || rawData.weeks.length === 0) {
      return { chartData: [], scatterData: [], latestMetrics: null, insights: [], availableTaxaList: [], protectiveTaxaList: [], opportunisticTaxaList: [] };
    }

    const data = [];
    const sData = [];
    const generatedInsights = [];
    const weeksCount = rawData.weeks.length;

    const getVal = (group, name, index) => (group && group[name] ? group[name][index] : 0);

    const protectiveTaxaList = rawData.protective_bacteria ? Object.keys(rawData.protective_bacteria) : [];
    const opportunisticTaxaList = rawData.opportunistic_bacteria ? Object.keys(rawData.opportunistic_bacteria) : [];
    
    const taxaSet = new Set([...protectiveTaxaList, ...opportunisticTaxaList]);
    
    // Dynamically add all top 5 bacteria names
    if (rawData.top5_names) {
      rawData.top5_names.forEach(k => taxaSet.add(k));
    }
    if (rawData.top5_bacteria && rawData.top5_bacteria["others"]) taxaSet.add("others");
    
    const availableTaxaList = Array.from(taxaSet);

    for (let i = 0; i < weeksCount; i++) {
      
      // Dynamically sum ALL protective bacteria in the dataset
      let sumProtective = 0;
      if (rawData.protective_bacteria) {
        Object.keys(rawData.protective_bacteria).forEach(key => {
          sumProtective += getVal(rawData.protective_bacteria, key, i);
        });
      }

      // Dynamically sum ALL opportunistic bacteria in the dataset
      let sumOpportunistic = 0;
      if (rawData.opportunistic_bacteria) {
        Object.keys(rawData.opportunistic_bacteria).forEach(key => {
          sumOpportunistic += getVal(rawData.opportunistic_bacteria, key, i);
        });
      }

      let pcaDistance = 0;
      if (i > 0) {
        const dx = rawData.pca_x[i] - rawData.pca_x[i - 1];
        const dy = rawData.pca_y[i] - rawData.pca_y[i - 1];
        pcaDistance = Math.sqrt(dx * dx + dy * dy);
      }

      const weekLabel = `W${rawData.weeks[i]}`;
      
      const weekData = {
        week: weekLabel,
        fecalcal: rawData.fecalcal[i],
        shannon: rawData.shannon_index[i],
        healthy_index: rawData.healthy_index[i],
        sumProtective,
        sumOpportunistic,
        sumTotal: sumProtective + sumOpportunistic,
        ratio: sumOpportunistic > 0 ? Number((sumProtective / sumOpportunistic).toFixed(2)) : sumProtective,
        pcaDistance,
        f_praus: getVal(rawData.protective_bacteria, "Faecalibacterium prausnitzii", i),
        e_coli: getVal(rawData.opportunistic_bacteria, "Escherichia coli", i),
      };

      availableTaxaList.forEach(taxa => {
        if (rawData.protective_bacteria && rawData.protective_bacteria[taxa]) {
          weekData[taxa] = rawData.protective_bacteria[taxa][i];
        } else if (rawData.opportunistic_bacteria && rawData.opportunistic_bacteria[taxa]) {
          weekData[taxa] = rawData.opportunistic_bacteria[taxa][i];
        } else if (rawData.top5_bacteria && rawData.top5_bacteria[taxa]) {
          weekData[taxa] = rawData.top5_bacteria[taxa][i];
        } else {
          weekData[taxa] = 0;
        }
      });

      data.push(weekData);
      sData.push({ week: weekLabel, x: rawData.pca_x[i], y: rawData.pca_y[i] });
    }

    const latest = data[weeksCount - 1];

    // CLINICAL PROFILING LOGIC
    const flareUpWeek = data.find(d => d.fecalcal > 200 && d.e_coli > 5); 
    if (flareUpWeek) {
      generatedInsights.push({ type: 'alert', text: `Dysbiotic flare-up detected at ${flareUpWeek.week}, driven by opportunistic overgrowth, correlating with high inflammation.` });
    }

    if (latest.f_praus < 5 && latest.fecalcal > 100) { 
      generatedInsights.push({ type: 'warning', text: `Low protective F. prausnitzii correlates with elevated Fecal Calprotectin (${latest.fecalcal.toFixed(0)}). Barrier health may be compromised.` });
    } else if (latest.sumProtective > latest.sumOpportunistic * 2) {
      generatedInsights.push({ type: 'success', text: `Protective bacteria are currently dominating the microbiome, correlating with healthy index stability.` });
    }

    if (weeksCount >= 3) {
      const last3Distances = data.slice(-3).map(d => d.pcaDistance);
      const isStable = last3Distances.every(d => d < 2.0); 
      if (isStable) {
        generatedInsights.push({ type: 'success', text: `Patient microbiome has achieved stable structural composition over recent weeks.` });
      } else {
        generatedInsights.push({ type: 'info', text: `Microbiome composition is currently volatile week-to-week based on PCA distance.` });
      }
    }

    return { chartData: data, scatterData: sData, latestMetrics: latest, insights: generatedInsights, availableTaxaList, protectiveTaxaList, opportunisticTaxaList };
  }, [rawData]);

  const getBtnStyle = (isActive, activeColor) => ({
    background: isActive ? activeColor : 'transparent',
    color: isActive ? '#fff' : 'var(--blue-light)',
    border: `1px solid ${isActive ? activeColor : 'var(--blue-dark-hover)'}`,
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'block',
    width: '100%',
    textAlign: 'left',
    marginBottom: '8px'
  });

  const getTaxaColor = (taxa) => {
    if (protectiveTaxaList.includes(taxa)) {
      return CHART_COLORS[protectiveTaxaList.indexOf(taxa) % CHART_COLORS.length];
    }
    if (opportunisticTaxaList.includes(taxa)) {
      return CHART_COLORS[(opportunisticTaxaList.indexOf(taxa) + 4) % CHART_COLORS.length]; // offset index for contrast
    }
    return '#94a3b8';
  };

  return (
    <div className="microbiome-wrapper">
      <div className="micro-intro">
        <h1>Longitudinal Microbiome Profiling</h1>
        <p>Upload patient sequence data to track gut composition, identify dysbiotic flare-ups, and monitor stability over time.</p>
      </div>

      <div className="micro-container">
        
        {/* PANEL: DATA INGESTION */}
        <div className="micro-panel">
          <h2 className="panel-title">Data Ingestion</h2>
          <div className="ingestion-box">
            <div className="upload-section">
              <span className="upload-label-text">UPLOAD TIME-SERIES DATASET</span>
              <div className="file-input-group">
                <input type="file" id="micro-file" accept=".csv,.json" onChange={handleFileChange} hidden />
                <label htmlFor="micro-file" className="btn-outline">Choose File</label>
                <span className="file-name">{file ? file.name : "No file chosen"}</span>
              </div>
            </div>
            <button className={`btn-primary ${loading ? 'loading' : ''}`} onClick={handleAnalysis} disabled={loading}>
              {loading ? "Analyzing Time-Series..." : "Run Analysis"}
            </button>
            {error && <p style={{color: 'var(--red)', marginTop: '10px'}}>{error}</p>}
          </div>
        </div>

        {/* RESULTS DASHBOARD */}
        {chartData.length > 0 && latestMetrics && (
          <div className="results-wrapper">
            
            <div className="profile-header">
              <h2 className="panel-title text-cyan">Analysis Profile: {rawData.participant_id || "Loaded"}</h2>
              <div className="badge outline-green">LIVE TRACKING</div>
            </div>

            {/* TWO SELECTOR CARDS FOR VIEWS */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', flexWrap: 'wrap' }}>
              <div 
                className={`metric-card`}
                style={{ 
                  cursor: 'pointer', flex: '1 1 300px', 
                  border: activeCard === 'visualization' ? '2px solid #06b6d4' : '1px solid var(--blue-dark-hover)', 
                  background: activeCard === 'visualization' ? 'var(--blue-dark-active)' : 'transparent',
                  textAlign: 'center', padding: '20px'
                }}
                onClick={() => setActiveCard('visualization')}
              >
                <h3 style={{ margin: 0, color: '#06b6d4' }}>Visualization and Analysis</h3>
                <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--blue-light)' }}>
                  View composition, inflammation timelines, and bacterial summation graphs.
                </p>
              </div>

              <div 
                className={`metric-card`}
                style={{ 
                  cursor: 'pointer', flex: '1 1 300px', 
                  border: activeCard === 'clinical' ? '2px solid #10b981' : '1px solid var(--blue-dark-hover)', 
                  background: activeCard === 'clinical' ? 'var(--blue-dark-active)' : 'transparent',
                  textAlign: 'center', padding: '20px'
                }}
                onClick={() => setActiveCard('clinical')}
              >
                <h3 style={{ margin: 0, color: '#10b981' }}>Clinical Summary & Panel</h3>
                <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: 'var(--blue-light)' }}>
                  View Health Index, Fecal Calprotectin, Shannon Index, and automated clinical summaries.
                </p>
              </div>
            </div>

            {/* ========================================== */}
            {/* VIEW 1: VISUALIZATION AND ANALYSIS         */}
            {/* ========================================== */}
            {activeCard === 'visualization' && (
              <>
                {/* GRAPH 1: Custom Composition Trajectory     */}
                <div className="micro-panel">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                    <div style={{ flex: '3 1 600px', minWidth: 0 }}>
                      <h3 className="panel-title text-cyan">Top 5 Bacteria Stacked Composition</h3>
                      <p style={{fontSize: '0.85rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Stacked area map of the top 5 taxa over time.</p>
                      
                      <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--blue-dark-hover)" />
                            <XAxis dataKey="week" stroke="var(--blue-light-active)" tick={{fontSize: 12}} />
                            <YAxis stroke="var(--blue-light-active)" tick={{fontSize: 12}} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--blue-darker)', borderColor: 'var(--blue-dark-hover)', color: 'var(--blue-light)' }} />
                            
                            {activeTaxa.length === 0 && (
                               <text x="50%" y="50%" textAnchor="middle" fill="#64748b" fontSize="14">Select bacteria from the panel to display</text>
                            )}
                            {activeTaxa.map((taxa, idx) => (
                              <Area 
                                key={taxa} type="monotone" dataKey={taxa} name={taxa} stackId="1" 
                                stroke={CHART_COLORS[rawData.top5_names.indexOf(taxa) % CHART_COLORS.length]} 
                                fill={CHART_COLORS[rawData.top5_names.indexOf(taxa) % CHART_COLORS.length]} 
                                fillOpacity={0.6} 
                              />
                            ))}
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div style={{ flex: '1 1 250px', backgroundColor: 'var(--blue-dark-active)', padding: '1.5rem', borderRadius: '10px', border: '1px solid var(--blue-dark-hover)' }}>
                      <h4 style={{marginTop: 0, color: 'var(--blue-light)'}}>Bacteria Selector (Top 5 Only)</h4>
                      <p style={{fontSize: '0.8rem', color: 'var(--green)', marginBottom: '15px'}}>Click to add/remove from stack:</p>
                      
                      <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
                        {rawData.top5_names && rawData.top5_names.map((taxa) => {
                          const isActive = activeTaxa.includes(taxa);
                          const activeColor = isActive ? CHART_COLORS[rawData.top5_names.indexOf(taxa) % CHART_COLORS.length] : '#334155';
                          return (
                            <button 
                              key={taxa}
                              onClick={() => handleToggleTaxa(taxa)}
                              style={{
                                ...getBtnStyle(isActive, activeColor),
                                fontSize: '0.75rem', padding: '6px 10px', marginBottom: '6px'
                              }}
                            >
                              {isActive ? '✓ ' : '+ '}{taxa}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRAPH 2: Fecalcal vs Time                  */}
                <div className="micro-panel">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                    <div style={{ flex: '3 1 600px', minWidth: 0 }}>
                      <h3 className="panel-title text-cyan">Inflammation & Core Metrics Overlay</h3>
                      <p style={{fontSize: '0.85rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Tracking Fecal Calprotectin with optional overlays.</p>
                      
                      <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--blue-dark-hover)" />
                            <XAxis dataKey="week" stroke="var(--blue-light-active)" tick={{fontSize: 12}} />
                            <YAxis yAxisId="left" stroke="var(--red)" tick={{fontSize: 12}} />
                            {g2Overlay !== 'none' && (
                              <YAxis yAxisId="right" orientation="right" stroke={g2Overlay === 'shannon' ? 'var(--blue-normal)' : 'var(--green)'} tick={{fontSize: 12}} />
                            )}
                            <Tooltip contentStyle={{ backgroundColor: 'var(--blue-darker)', borderColor: 'var(--blue-dark-hover)', color: 'var(--blue-light)' }} />
                            <Legend />
                            
                            <Line yAxisId="left" type="monotone" dataKey="fecalcal" name="Fecal Calprotectin" stroke="var(--red)" strokeWidth={3} dot={{r: 4}} />
                            
                            {g2Overlay === 'shannon' && <Line yAxisId="right" type="monotone" dataKey="shannon" name="Shannon Index" stroke="var(--blue-normal)" strokeWidth={3} dot={{r: 4}} />}
                            {g2Overlay === 'healthy_index' && <Line yAxisId="right" type="monotone" dataKey="healthy_index" name="Healthy Index" stroke="var(--green)" strokeWidth={3} dot={{r: 4}} />}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div style={{ flex: '1 1 250px', backgroundColor: 'var(--blue-dark-active)', padding: '1.5rem', borderRadius: '10px', border: '1px solid var(--blue-dark-hover)' }}>
                      <h4 style={{marginTop: 0, color: 'var(--blue-light)'}}>Overlay Control</h4>
                      <p style={{fontSize: '0.8rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Choose metric to compare with inflammation:</p>
                      
                      <button onClick={() => setG2Overlay('shannon')} style={getBtnStyle(g2Overlay === 'shannon', 'var(--blue-normal)')}>
                        {g2Overlay === 'shannon' ? '◉' : '○'} Shannon Index
                      </button>
                      <button onClick={() => setG2Overlay('healthy_index')} style={getBtnStyle(g2Overlay === 'healthy_index', 'var(--green)')}>
                        {g2Overlay === 'healthy_index' ? '◉' : '○'} Healthy Index
                      </button>
                      <button onClick={() => setG2Overlay('none')} style={getBtnStyle(g2Overlay === 'none', '#64748b')}>
                        {g2Overlay === 'none' ? '◉' : '○'} None
                      </button>
                    </div>
                  </div>
                </div>

                {/* GRAPH 3: Bacterial Summations & Ratio      */}
                <div className="micro-panel">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                    <div style={{ flex: '3 1 600px', minWidth: 0 }}>
                      <h3 className="panel-title text-cyan">Bacterial Group Summations & Ratio</h3>
                      <p style={{fontSize: '0.85rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Summation trajectories of Protective vs. Opportunistic bacteria and their ratio.</p>
                      
                      <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                          <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--blue-dark-hover)" />
                            <XAxis dataKey="week" stroke="var(--blue-light-active)" tick={{fontSize: 12}} />
                            <YAxis yAxisId="left" stroke="var(--blue-light-active)" tick={{fontSize: 12}} />
                            {g3ShowRatio && (
                              <YAxis yAxisId="right" orientation="right" stroke="var(--green)" tick={{fontSize: 12}} />
                            )}
                            <Tooltip contentStyle={{ backgroundColor: 'var(--blue-darker)', borderColor: 'var(--blue-dark-hover)', color: 'var(--blue-light)' }} />
                            <Legend />
                            
                            {g3ShowProSum && <Line yAxisId="left" type="monotone" dataKey="sumProtective" name="Protective Summation" stroke="var(--blue-normal)" strokeWidth={3} dot={{r: 4}} />}
                            {g3ShowOppSum && <Line yAxisId="left" type="monotone" dataKey="sumOpportunistic" name="Opportunistic Summation" stroke="var(--red)" strokeWidth={3} dot={{r: 4}} />}
                            {g3ShowRatio && <Line yAxisId="right" type="monotone" dataKey="ratio" name="Pro/Opp Ratio" stroke="var(--green)" strokeWidth={3} dot={{r: 4}} />}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div style={{ flex: '1 1 250px', backgroundColor: 'var(--blue-dark-active)', padding: '1.5rem', borderRadius: '10px', border: '1px solid var(--blue-dark-hover)' }}>
                      <h4 style={{marginTop: 0, color: 'var(--blue-light)'}}>Summation Controls</h4>
                      <p style={{fontSize: '0.8rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Toggle summation lines:</p>
                      
                      <button onClick={() => setG3ShowProSum(!g3ShowProSum)} style={getBtnStyle(g3ShowProSum, 'var(--blue-normal)')}>
                        {g3ShowProSum ? '👁' : '🚫'} Protective Sum
                      </button>
                      <button onClick={() => setG3ShowOppSum(!g3ShowOppSum)} style={getBtnStyle(g3ShowOppSum, 'var(--red)')}>
                        {g3ShowOppSum ? '👁' : '🚫'} Opportunistic Sum
                      </button>
                      <button onClick={() => setG3ShowRatio(!g3ShowRatio)} style={getBtnStyle(g3ShowRatio, 'var(--green)')}>
                        {g3ShowRatio ? '👁' : '🚫'} Pro/Opp Ratio
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ========================================== */}
            {/* VIEW 2: CLINICAL SUMMARY & PANEL           */}
            {/* ========================================== */}
            {activeCard === 'clinical' && (
              <>
                {/* TOP METRICS ROW */}
                <div className="metrics-top-row">
                  <div className="metric-card" title="Composite score representing overall gut stability and function based on reference ranges.">
                    <span className="metric-title">HEALTHY INDEX ℹ️</span>
                    <span className="metric-value text-green">{latestMetrics.healthy_index.toFixed(1)}</span>
                    <span className="metric-sub">Latest Week</span>
                  </div>
                  <div className={`metric-card ${latestMetrics.fecalcal > 200 ? 'alert-card' : ''}`}>
                    <span className="metric-title">FECAL CALPROTECTIN ℹ️</span>
                    <span className={`metric-value ${latestMetrics.fecalcal > 200 ? 'text-red' : 'text-cyan'}`}>
                      {latestMetrics.fecalcal > 200 && '⚠️ '} {latestMetrics.fecalcal.toFixed(0)}
                    </span>
                    <span className="metric-sub">{latestMetrics.fecalcal > 200 ? 'High Inflammation' : 'Normal Range'}</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">PRO / OPP RATIO ℹ️</span>
                    <span className="metric-value text-cyan">{latestMetrics.ratio}</span>
                    <span className="metric-sub">Protective dominance multiplier</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-title">SHANNON INDEX ℹ️</span>
                    <span className="metric-value text-green">{latestMetrics.shannon.toFixed(2)}</span>
                    <span className="metric-sub">Latest Biodiversity</span>
                  </div>
                </div>

                <div className="insights-panel">
                  <h3 className="panel-title text-cyan" style={{marginBottom: '15px'}}>Automated Clinical Summary</h3>
                  <div className="insights-list">
                    {insights.length > 0 ? insights.map((insight, idx) => (
                      <div key={idx} className={`insight-bullet ${insight.type}`}>
                        {insight.text}
                      </div>
                    )) : (
                      <div className="insight-bullet info">No significant clinical alerts detected in this dataset.</div>
                    )}
                  </div>
                </div>

                {/* GRAPH 4: Health Index Profiling            */}
                <div className="micro-panel">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                    <div style={{ flex: '3 1 600px', minWidth: 0 }}>
                      <h3 className="panel-title text-cyan">Health Index Estimation</h3>
                      <p style={{fontSize: '0.85rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Health Index plotted against individual bacterial values.</p>
                      
                      <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--blue-dark-hover)" />
                            <XAxis dataKey="week" stroke="var(--blue-light-active)" tick={{fontSize: 12}} />
                            <YAxis yAxisId="left" stroke="var(--green)" tick={{fontSize: 12}} />
                            <YAxis yAxisId="right" orientation="right" stroke="var(--blue-light-active)" tick={{fontSize: 12}} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--blue-darker)', borderColor: 'var(--blue-dark-hover)', color: 'var(--blue-light)' }} />
                            <Legend />
                            
                            <Line yAxisId="left" type="monotone" dataKey="healthy_index" name="Healthy Index" stroke="var(--green)" strokeWidth={4} dot={{r: 4}} />
                            {g4SelectedTaxa.map(taxa => (
                              <Bar key={taxa} yAxisId="right" dataKey={taxa} name={taxa} fill={getTaxaColor(taxa)} opacity={0.8} radius={[4, 4, 0, 0]} />
                            ))}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div style={{ flex: '1 1 250px', backgroundColor: 'var(--blue-dark-active)', padding: '1.5rem', borderRadius: '10px', border: '1px solid var(--blue-dark-hover)', display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{marginTop: 0, color: 'var(--blue-light)', marginBottom: '5px'}}>Bacteria Overlays</h4>
                      <p style={{fontSize: '0.8rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Select bacteria to overlay as bars:</p>

                      <h5 style={{margin: '0 0 8px 0', color: 'var(--blue-normal)'}}>Protective Bacteria</h5>
                      <div style={{ maxHeight: '110px', overflowY: 'auto', paddingRight: '5px', marginBottom: '10px' }}>
                        {protectiveTaxaList.map((taxa) => {
                          const isActive = g4SelectedTaxa.includes(taxa);
                          return (
                            <button 
                              key={taxa} onClick={() => handleToggleG4Taxa(taxa)} 
                              style={{ ...getBtnStyle(isActive, getTaxaColor(taxa)), fontSize: '0.75rem', padding: '6px 10px', marginBottom: '6px' }}>
                              {isActive ? '✓ ' : '+ '} {taxa}
                            </button>
                          );
                        })}
                      </div>

                      <h5 style={{margin: '0 0 8px 0', color: 'var(--red)'}}>Opportunistic Bacteria</h5>
                      <div style={{ maxHeight: '110px', overflowY: 'auto', paddingRight: '5px' }}>
                        {opportunisticTaxaList.map((taxa) => {
                          const isActive = g4SelectedTaxa.includes(taxa);
                          return (
                            <button 
                              key={taxa} onClick={() => handleToggleG4Taxa(taxa)} 
                              style={{ ...getBtnStyle(isActive, getTaxaColor(taxa)), fontSize: '0.75rem', padding: '6px 10px', marginBottom: '6px' }}>
                              {isActive ? '✓ ' : '+ '} {taxa}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRAPH 5: Shannon Index Profiling           */}
                <div className="micro-panel">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                    <div style={{ flex: '3 1 600px', minWidth: 0 }}>
                      <h3 className="panel-title text-cyan">Shannon Diversity Profiling</h3>
                      <p style={{fontSize: '0.85rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Diversity correlation with individual bacterial trajectories.</p>
                      
                      <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--blue-dark-hover)" />
                            <XAxis dataKey="week" stroke="var(--blue-light-active)" tick={{fontSize: 12}} />
                            <YAxis yAxisId="left" stroke="var(--blue-normal)" tick={{fontSize: 12}} />
                            <YAxis yAxisId="right" orientation="right" stroke="var(--blue-light-active)" tick={{fontSize: 12}} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--blue-darker)', borderColor: 'var(--blue-dark-hover)', color: 'var(--blue-light)' }} />
                            <Legend />
                            
                            <Line yAxisId="left" type="monotone" dataKey="shannon" name="Shannon Index" stroke="var(--blue-normal)" strokeWidth={4} dot={{r: 4}} />
                            {g5SelectedTaxa.map(taxa => (
                              <Line key={taxa} yAxisId="right" type="monotone" dataKey={taxa} name={taxa} stroke={getTaxaColor(taxa)} strokeWidth={2} dot={{r: 3}} />
                            ))}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div style={{ flex: '1 1 250px', backgroundColor: 'var(--blue-dark-active)', padding: '1.5rem', borderRadius: '10px', border: '1px solid var(--blue-dark-hover)', display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{marginTop: 0, color: 'var(--blue-light)', marginBottom: '5px'}}>Bacteria Overlays</h4>
                      <p style={{fontSize: '0.8rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Select bacteria to overlay as lines:</p>

                      <h5 style={{margin: '0 0 8px 0', color: 'var(--blue-normal)'}}>Protective Bacteria</h5>
                      <div style={{ maxHeight: '110px', overflowY: 'auto', paddingRight: '5px', marginBottom: '10px' }}>
                        {protectiveTaxaList.map((taxa) => {
                          const isActive = g5SelectedTaxa.includes(taxa);
                          return (
                            <button 
                              key={taxa} onClick={() => handleToggleG5Taxa(taxa)} 
                              style={{ ...getBtnStyle(isActive, getTaxaColor(taxa)), fontSize: '0.75rem', padding: '6px 10px', marginBottom: '6px' }}>
                              {isActive ? '✓ ' : '+ '} {taxa}
                            </button>
                          );
                        })}
                      </div>

                      <h5 style={{margin: '0 0 8px 0', color: 'var(--red)'}}>Opportunistic Bacteria</h5>
                      <div style={{ maxHeight: '110px', overflowY: 'auto', paddingRight: '5px' }}>
                        {opportunisticTaxaList.map((taxa) => {
                          const isActive = g5SelectedTaxa.includes(taxa);
                          return (
                            <button 
                              key={taxa} onClick={() => handleToggleG5Taxa(taxa)} 
                              style={{ ...getBtnStyle(isActive, getTaxaColor(taxa)), fontSize: '0.75rem', padding: '6px 10px', marginBottom: '6px' }}>
                              {isActive ? '✓ ' : '+ '} {taxa}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* GRAPH 6: PCA Plot */}
                <div className="micro-panel">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
                    <div style={{ flex: '3 1 600px', minWidth: 0 }}>
                      <h3 className="panel-title text-cyan">PCA Beta-Diversity Trajectory</h3>
                      <p style={{fontSize: '0.85rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>2D PCA plot tracking the patient's gut microbiome structural shift over time.</p>
                      
                      <div style={{ width: '100%', height: 350 }}>
                        <ResponsiveContainer>
                          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--blue-dark-hover)" />
                            <XAxis type="number" dataKey="x" name="PCA 1" stroke="var(--blue-light-active)" />
                            <YAxis type="number" dataKey="y" name="PCA 2" stroke="var(--blue-light-active)" />
                            <Tooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{ backgroundColor: 'var(--blue-darker)', borderColor: 'var(--blue-dark-hover)', color: 'var(--blue-light)' }} />
                            <Scatter name="Patient Trajectory" data={scatterData} fill="var(--blue-normal)">
                              {pcaPath && <Line type="monotone" dataKey="y" stroke="var(--blue-normal)" strokeWidth={2} />}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div style={{ flex: '1 1 250px', backgroundColor: 'var(--blue-dark-active)', padding: '1.5rem', borderRadius: '10px', border: '1px solid var(--blue-dark-hover)' }}>
                      <h4 style={{marginTop: 0, color: 'var(--blue-light)'}}>PCA Controls</h4>
                      <p style={{fontSize: '0.8rem', color: 'var(--blue-light-active)', marginBottom: '15px'}}>Toggle visual elements:</p>
                      
                      <button onClick={() => setPcaPath(!pcaPath)} style={getBtnStyle(pcaPath, 'var(--blue-normal)')}>
                        {pcaPath ? '👁' : '🚫'} Show Path Trajectory
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default Microbiome;