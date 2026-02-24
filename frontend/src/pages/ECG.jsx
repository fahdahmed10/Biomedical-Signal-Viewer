import React, { useState } from "react";
import axios from "axios"; //deal with servce
import "./ECG.css";

import {
  FaHeartbeat,
  FaProjectDiagram,
  FaTh,
  FaCompass,
  FaBrain,
  FaChartLine,
} from "react-icons/fa";

import ECGViewer from "../components/ECG/ECGViewer";
import XORViewer from "../components/ECG/XORViewer";
import RecurrenceViewer from "../components/ECG/RecurrenceViewer";
import PolarViewer from "../components/ECG/PolarViewer";

export default function ECG() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [predictLoading, setPredictLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("pretrained");

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a CSV file first");
    const formData = new FormData();
    formData.append("file", file);
    try {
      setLoading(true);
      const res = await axios.post("http://localhost:8000/ecg/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setPrediction(null);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Please check the file format and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (model) => {
    if (!file) return alert("Please upload a file first");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", model);  
    try {
      setPredictLoading(true);
      const res = await axios.post("http://localhost:8000/ecg/predict", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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
      {/* ========== HERO SECTION ========== */}
      <section id="home" className="hero-section">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">
            ECG <span className="hero-highlight">Analysis</span> Platform
          </h1>
          <p className="hero-subtitle">
            Real-time multi-channel ECG visualization and automated cardiac
            diagnostic tools and historical record access.
          </p>
          <button className="hero-cta" onClick={() => scrollToSection("ai-models")}>
            Explore Models
          </button>
        </div>
        <div className="hero-image">
          <FaHeartbeat className="hero-icon" />
        </div>
      </section>

      {/* ========== AI MODELS CARDS ========== */}
      <section id="ai-models" className="models-section">
        <h2 className="section-title">AI Models</h2>
        <div className="models-grid">
          {/* Pretrained Model Card */}
          <div
            className={`model-card ${selectedModel === "pretrained" ? "active" : ""}`}
            onClick={() => {
              setSelectedModel("pretrained");
              scrollToSection("upload-section");
            }}
          >
            <div className="model-icon">
              <FaBrain />
            </div>
            <h3 className="model-title">Pretrained Model</h3>
            <p className="model-desc">
              Deep learning (HuBERT-ECG) trained on massive ECG datasets for
              arrhythmia classification.
            </p>
            <ul className="model-features">
              <li>Multi-channel support</li>
              <li>High accuracy</li>
              <li>Real-time inference</li>
            </ul>
          </div>

          {/* Classical Model Card */}
          <div
            className={`model-card ${selectedModel === "classical" ? "active" : ""}`}
            onClick={() => {
              setSelectedModel("classical");
              scrollToSection("upload-section");
            }}
          >
            <div className="model-icon">
              <FaChartLine />
            </div>
            <h3 className="model-title">Classical Model</h3>
            <p className="model-desc">
              Random Forest classifier using statistical features and
              autocorrelation for explainable results.
            </p>
            <ul className="model-features">
              <li>Interpretable</li>
              <li>Fast training</li>
              <li>Baseline comparison</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ========== SIGNAL VIEWERS CARDS ========== */}
      <section className="viewers-cards-section">
        <h2 className="section-title">Signal Viewers</h2>
        <div className="models-grid">
          {/* ECG Viewer Card */}
          <div className="model-card" onClick={() => scrollToSection("section-ecg")}>
            <div className="model-icon">
              <FaHeartbeat />
            </div>
            <h3 className="model-title">ECG Viewer</h3>
            <p className="model-desc">Multi-channel signal visualization</p>
          </div>

          {/* XOR Viewer Card */}
          <div className="model-card" onClick={() => scrollToSection("section-xor")}>
            <div className="model-icon">
              <FaProjectDiagram />
            </div>
            <h3 className="model-title">XOR Viewer</h3>
            <p className="model-desc">Signal difference analysis</p>
          </div>

          {/* Recurrence Plot Card */}
          <div className="model-card" onClick={() => scrollToSection("section-rec")}>
            <div className="model-icon">
              <FaTh />
            </div>
            <h3 className="model-title">Recurrence Plot</h3>
            <p className="model-desc">Channel correlation visualization</p>
          </div>

          {/* Polar Viewer Card */}
          <div className="model-card" onClick={() => scrollToSection("section-polar")}>
            <div className="model-icon">
              <FaCompass />
            </div>
            <h3 className="model-title">Polar Viewer</h3>
            <p className="model-desc">Phase-space signal representation</p>
          </div>
        </div>
      </section>

      {/* ========== UPLOAD SECTION ========== */}
      <section id="upload-section" className="task-section alt-bg">
        <h2>Upload ECG Signal</h2>
        <div className="upload-workspace">
          <input
            type="file"
            accept=".csv,.zip"
            onChange={(e) => setFile(e.target.files[0])}
          />
          <button onClick={handleUpload} disabled={loading}>
            {loading ? "Processing..." : "Upload & Analyze"}
          </button>
        </div>

        {/* Model Selection Buttons */}
        <div className="model-buttons">
          <button
            className={`model-select-btn ${selectedModel === "pretrained" ? "active" : ""}`}
            onClick={() => setSelectedModel("pretrained")}
          >
            Pretrained Model
          </button>
          <button
            className={`model-select-btn ${selectedModel === "classical" ? "active" : ""}`}
            onClick={() => setSelectedModel("classical")}
          >
            Classical Model
          </button>
          {file && (
            <button
              className="predict-btn"
              onClick={() => handlePredict(selectedModel)}
              disabled={predictLoading}
            >
              {predictLoading ? "Analyzing..." : "Run Diagnosis"}
            </button>
          )}
        </div>

        {prediction && (
          <div className="prediction-box">
            <h3>
              Diagnosis Results ({selectedModel === "pretrained" ? "Pretrained AI" : "Classical ML"})
            </h3>
            {Object.entries(prediction).map(([label, value]) => (
              <div key={label} className="prediction-item">
                <span>{label}</span>
                <span>{(value * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========== VIEWERS SECTIONS ========== */}
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