import './HeroSignal.css';

function HeroSignal() {
  return (
    <div className="hero-signal-container">
      <div className="signal-grid"></div>
      
      {/* The SVG Line Animation */}

      <div className="hero-text">
        <h1>Biomedical Signal Viewer</h1>
        <p>Real-time analysis for ECG, EEG, Acoustic, Stoke and Microbiome data.</p>
      </div>

      <svg className="ecg-svg" viewBox="0 0 500 100" preserveAspectRatio="none">
        <path 
          className="ecg-line"
          d="M0,50 L20,50 L30,20 L40,80 L50,50 L100,50 L120,50 L130,10 L140,90 L150,50 L200,50 L220,50 L230,20 L240,80 L250,50 L300,50 L320,50 L330,10 L340,90 L350,50 L400,50 L420,50 L430,20 L440,80 L450,50 L500,50" 
        />
      </svg>

      
    </div>
  );
}

export default HeroSignal;