import React, { useState } from "react";
import axios from "axios";
import "./ECG.css";

import {
  FaHeartbeat,
  FaProjectDiagram,
  FaTh,
  FaCompass,
  FaArrowDown,
} from "react-icons/fa";

import ECGViewer from "../components/ECG/ECGViewer";
import XORViewer from "../components/ECG/XORViewer";
import RecurrenceViewer from "../components/ECG/RecurrenceViewer";
import PolarViewer from "../components/ECG/PolarViewer";

export default function ECG() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // AI MODEL STATES
  const [prediction, setPrediction] = useState(null);
  const [predictLoading, setPredictLoading] = useState(false);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ 
      behavior: "smooth",
      block: "start"
    });
  };

  // ================= UPLOAD =================
  const handleUpload = async () => {
    if (!file) return alert("Please select a CSV file first");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await axios.post(
        "http://localhost:8000/ecg/upload",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setResult(res.data);
      setPrediction(null);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Please check the file format and try again.");
    } finally {
      setLoading(false);
    }
  };

  // ================= AI PREDICT =================
  const handlePredict = async () => {
    if (!file) return alert("Please upload a file first");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setPredictLoading(true);

      const res = await axios.post(
        "http://localhost:8000/ecg/predict",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setPrediction(res.data.prediction);
    } catch (err) {
      console.error("Prediction error:", err);
      alert("Prediction failed. Please try again.");
    } finally {
      setPredictLoading(false);
    }
  };

  return (
    <div className="ecg-page">

      {/* ================= INTRO ================= */}
      <section className="ecg-intro">
        <div className="intro-left">
          <div className="heartbeat-scene">
            <FaHeartbeat />
          </div>

          <div className="intro-text">
            <h1>ECG Analysis Platform</h1>
            <p>
              Advanced ECG signal visualization and analysis with 
              multiple viewing modes and AI-powered diagnosis
            </p>
          </div>
        </div>

        <div className="intro-right">
          <div className="nav-cards-container">
            <div className="nav-card" onClick={() => scrollToSection("section-ecg")}>
              <div className="icon-box"><FaHeartbeat /></div>
              <div className="card-info">
                <h3>ECG Viewer</h3>
                <p>Multi-channel signal visualization</p>
              </div>
              <FaArrowDown className="go-icon" />
            </div>

            <div className="nav-card" onClick={() => scrollToSection("section-xor")}>
              <div className="icon-box"><FaProjectDiagram /></div>
              <div className="card-info">
                <h3>XOR Viewer</h3>
                <p>Signal difference analysis</p>
              </div>
              <FaArrowDown className="go-icon" />
            </div>

            <div className="nav-card" onClick={() => scrollToSection("section-rec")}>
              <div className="icon-box"><FaTh /></div>
              <div className="card-info">
                <h3>Recurrence Plot</h3>
                <p>Channel correlation visualization</p>
              </div>
              <FaArrowDown className="go-icon" />
            </div>

            <div className="nav-card" onClick={() => scrollToSection("section-polar")}>
              <div className="icon-box"><FaCompass /></div>
              <div className="card-info">
                <h3>Polar Viewer</h3>
                <p>Phase-space signal representation</p>
              </div>
              <FaArrowDown className="go-icon" />
            </div>
          </div>
        </div>
      </section>

      {/* ================= UPLOAD + AI ================= */}
      <section className="task-section alt-bg">
        <h2>Upload ECG Signal</h2>

        <div className="upload-workspace">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <button onClick={handleUpload} disabled={loading}>
            {loading ? "Processing..." : "Upload & Analyze"}
          </button>

          {file && (
            <button
              className="predict-btn"
              onClick={handlePredict}
              disabled={predictLoading}
            >
              {predictLoading ? "Analyzing..." : "AI Diagnosis"}
            </button>
          )}
        </div>

        {/* ===== AI RESULT ===== */}
        {prediction && (
          <div className="prediction-box">
            <h3>AI Diagnosis Results</h3>

            {Object.entries(prediction).map(([label, value]) => (
              <div key={label} className="prediction-item">
                <span>{label}</span>
                <span>{(value * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ================= VIEWERS ================= */}
      <section id="section-ecg" className="task-section">
        <h2>ECG Viewer</h2>
        <div className="workspace">
          <ECGViewer data={result} />
        </div>
      </section>

      <section id="section-xor" className="task-section alt-bg">
        <h2>XOR Viewer</h2>
        <div className="workspace">
          <XORViewer data={result} />
        </div>
      </section>

      <section id="section-rec" className="task-section">
        <h2>Recurrence Plot</h2>
        <div className="workspace">
          <RecurrenceViewer data={result} />
        </div>
      </section>

      <section id="section-polar" className="task-section alt-bg">
        <h2>Polar Viewer</h2>
        <div className="workspace">
          <PolarViewer data={result} />
        </div>
      </section>

    </div>
  );
}