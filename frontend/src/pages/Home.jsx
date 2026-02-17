import HeroSignal from '../components/HeroSignal';
import { Link } from 'react-router-dom';
import './Home.css'; 

// --- ICON IMPORTS ---
import { FaHeart, FaBrain } from "react-icons/fa";
import { GiSoundWaves } from "react-icons/gi";
import { IoMdStats } from "react-icons/io";
import Icon from '@mdi/react';
import { mdiBacteria } from '@mdi/js';

// --- THE DATA ---
const signalsData = [
  {
    id: 'ecg',
    title: 'ECG Analysis',
    desc: 'Electrocardiogram monitoring for heart health.',
    features: ['Upload CSV/DAT files', 'Real-time Visualization', 'Adjust Playback Speed', 'Peak Detection'],
    link: '/ecg',
    icon: <FaHeart /> 
  },
  {
    id: 'eeg',
    title: 'EEG Brainwaves',
    desc: 'Brain activity monitoring and wave analysis.',
    features: ['Multi-channel support', 'Frequency filtering', 'Alpha/Beta wave detection', 'Voltage mapping'],
    link: '/eeg',
    icon: <FaBrain />
  },
  {
    id: 'acoustic',
    title: 'Acoustic Signal',
    desc: 'Audio processing and sound wave analysis.',
    features: ['Spectrogram View', 'Noise Reduction', 'Playback Controls', 'Frequency Analysis'],
    link: '/acoustic',
    icon: <GiSoundWaves />
  },
  {
    id: 'microbiome',
    title: 'Microbiome',
    desc: 'Biological data analysis for gut health.',
    features: ['Bacteria Composition', 'Diversity Charts', 'Sample Comparison', 'Export Reports'],
    link: '/microbiome',
    // MDI icons use a different prop for size. 
    // size={2} makes it approx 3rem to match the others.
    icon: <Icon path={mdiBacteria} size={2} />
  },
  {
    id: 'stock',
    title: 'Stock Market',
    desc: 'Financial time-series data visualization.',
    features: ['Candlestick Charts', 'Moving Averages', 'Zoom & Pan', 'Trend Indicators'],
    link: '/stock',
    icon: <IoMdStats />
  }
];
function Home() {
  return (
    <div className="home-page">
      <HeroSignal />

      <div className="page-content">
        <h2 className="section-title">Available Signal Tools</h2>
        
        {/* --- 2. THE CARD GRID --- */}
        <div className="cards-grid">
          {signalsData.map((signal) => (
            <div key={signal.id} className="signal-card">
              <div className="card-icon">{signal.icon}</div>
              <h3>{signal.title}</h3>
              <p className="card-desc">{signal.desc}</p>
              
              <ul className="card-features">
                {signal.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>

              <Link to={signal.link} className="card-button">
                Open Viewer
              </Link>
            </div>
          ))}
        </div>
        
      </div>
    </div>
  );
}

export default Home;