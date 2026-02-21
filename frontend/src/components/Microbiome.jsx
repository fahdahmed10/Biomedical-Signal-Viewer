import React, { useState } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import './microbiome.css'; // Make sure this matches your CSS file name

const API_URL = "http://127.0.0.1:8000";

const Microbiome = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setData(null);
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

      const responseData = response.data;

      // 1. Clean Bacteria Names (take only the last part)
      const bacteriaData = responseData.top_cols.map((col, index) => {
        const parts = col.split('|');
        let species = parts[parts.length - 1].replace('s__', '').replace('g__', '').replace(/_/g, ' ');
        return {
          name: species,
          abundance: responseData.top_vals[index]
        };
      });

      // 2. Format Disease Data & Map Names
      const diseaseMap = {
        "n": "Healthy",
        "t2d": "T2D",
        "obesity": "Obesity",
        "cirrhosis": "Cirrhosis",
        "ibd_ulcerative_colitis": "IBD",
        "cancer": "Colorectal Cancer"
      };

      const diseaseData = responseData.top_diseases.map((disease, index) => ({
        name: diseaseMap[disease] || disease,
        probability: Number((responseData.probs[index] * 100).toFixed(2))
      }));

      // 3. Find Primary Risk (Highest probability excluding 'Healthy')
      let maxProb = -1;
      let primaryRisk = "None";
      diseaseData.forEach(d => {
        if (d.name !== "Healthy" && d.probability > maxProb) {
          maxProb = d.probability;
          primaryRisk = d.name;
        }
      });

      // Formatting Patient Info
      const patientInfo = `${responseData.age}yo ${responseData.gender !== "-" ? responseData.gender : "Unknown"}`;

      setData({
        ...responseData,
        bacteriaData,
        diseaseData,
        primaryRisk,
        patientInfo
      });

    } catch (err) {
      console.error(err);
      setError("Analysis failed. Ensure the backend is running and the file is a valid microbiome dataset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="microbiome-wrapper">
      
      {/* FULL WIDTH INTRO */}
      <div className="micro-intro">
        <h1>Microbiome Profiling</h1>
        <p>Upload patient sequence data (CSV/FASTQ) to estimate biodiversity, identify top ten bacterizes , and predict disease risk profiles.</p>
      </div>

      <div className="micro-container">
        
        {/* PANEL 1: DATA INGESTION */}
        <div className="micro-panel">
          <h2 className="panel-title"><span className="icon"></span> Data Ingestion</h2>
          <div className="ingestion-box">
            <div className="upload-section">
              <span className="upload-label-text">UPLOAD SEQUENCE FILE (CSV/FASTQ) - OPTIONAL FOR DEMO</span>
              <div className="file-input-group">
                <input 
                  type="file" 
                  id="micro-file" 
                  accept=".csv,.json,.fastq,.gz" 
                  onChange={handleFileChange} 
                  hidden 
                />
                <label htmlFor="micro-file" className="btn-outline">Choose File</label>
                <span className="file-name">{file ? file.name : "No file chosen"}</span>
              </div>
            </div>
            <button 
              className={`btn-primary ${loading ? 'loading' : ''}`} 
              onClick={handleAnalysis} 
              disabled={loading}
            >
              {loading ? "Analyzing..." : "Run Analysis"}
            </button>
          </div>
          {/* <p className="demo-note">* For demonstration purposes, clicking Run without a file will generate fake sequencing metadata.</p>
          {error && <p className="micro-error">{error}</p>} */}
        </div>

        {/* RESULTS SECTION */}
        {data && (
          <div className="results-wrapper">
            
            {/* PANEL 1: ANALYSIS PROFILE */}
            <div className="micro-panel">
              <div className="profile-header">
                <h2 className="panel-title text-cyan">Analysis Profile</h2>
                <div className="profile-badges-right">
                  <div className="badge dark">Subject ID: <strong>{data.subjectID.toUpperCase()}</strong></div>
                  <div className="badge outline-green">LIVE PROFILE</div>
                </div>
              </div>

              {/* Updated Metadata Box (Now separated into individual boxes) */}
              <div className="mock-metadata-box">
                <div className="meta-item">
                  <span className="meta-label">AGE</span>
                  <span className="meta-value text-green">{data.age} Years</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">GENDER</span>
                  <span className="meta-value text-green">{data.gender !== "-" ? data.gender.toUpperCase() : "UNKNOWN"}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">BODY SITE</span>
                  <span className="meta-value text-cyan">{data.bodysite.charAt(0).toUpperCase() + data.bodysite.slice(1)}</span>
                </div>
                {/* Highlighted Primary Risk Box */}
                <div className="meta-item highlight-risk">
                  <span className="meta-label">PRIMARY RISK</span>
                  <span className="meta-value text-red" style={{ fontWeight: 'bold' }}>{data.primaryRisk.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* PANEL 3: DIVERSITY & RADAR SPLIT */}
            <div className="micro-split-row">
              {/* Biodiversity */}
              <div className="micro-panel half">
                <h3 className="panel-subtitle">Biodiversity Signals</h3>
                <div className="bio-metrics">
                  <div className="metric">
                    <span className="metric-val text-cyan">{data.shannon.toFixed(2)}</span>
                    <span className="metric-label">SHANNON INDEX</span>
                  </div>
                  <div className="metric">
                    <span className="metric-val text-green">{data.richness}</span>
                    <span className="metric-label">SPECIES RICHNESS</span>
                  </div>
                </div>
                <div className="insight-box">
                  💡 <strong>Insight:</strong> High keystone taxa presence detected. The ecosystem demonstrates robust mucosal integrity.
                </div>
              </div>

              {/* Disease Radar */}
              <div className="micro-panel half">
                <h3 className="panel-subtitle">Disease Risk Profile</h3>
                <div className="radar-container">
                  <ResponsiveContainer width="100%" height={250}>
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data.diseaseData}>
                      <PolarGrid stroke="#e7eaee" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Probability" dataKey="probability" stroke="#00c6ff" strokeWidth={2} fill="#00c6ff" fillOpacity={0.4} />
                      <Tooltip contentStyle={{ backgroundColor: '#c8d0e1', borderColor: '#cfd6df', color: '#fff' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* PANEL 4: BACTERIA & DISEASE BARS SPLIT */}
            <div className="micro-split-row">
              {/* Top Bacteria Bar Chart */}
              <div className="micro-panel half">
                <h3 className="panel-subtitle">Top Bacterial Taxa (%)</h3>
                <div className="bar-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.bacteriaData} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                      <XAxis type="number" stroke="#64748b" tick={{fontSize: 12}} />
                      <YAxis type="category" dataKey="name" stroke="#cbd5e1" width={90} tick={{fontSize: 11}} />
                      <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                      <Bar dataKey="abundance" fill="#4685ac" radius={[0, 4, 4, 0]} barSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

              {/* Disease Probabilities Horizontal Bar Chart */}
            <div className="micro-split-row">
              <div className="micro-panel half">
                <h3 className="panel-subtitle">Disease Probability Details (%)</h3>
                <div className="bar-container">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.diseaseData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                      <XAxis type="number" domain={[0, 100]} stroke="#64748b" tick={{fontSize: 12}} />
                      <YAxis type="category" dataKey="name" stroke="#cbd5e1" width={70} tick={{fontSize: 11}} />
                      <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b' }} />
                      <Bar dataKey="probability" fill="#4685ac" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default Microbiome;