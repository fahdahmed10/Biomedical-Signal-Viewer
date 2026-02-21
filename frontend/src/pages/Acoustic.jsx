import React from 'react';
import './Acoustic.css';
import { FaCarSide, FaWaveSquare, FaRobot, FaArrowDown } from "react-icons/fa";

// Import the sub-task components
import DopplerSim from '../components/Acoustic/DopplerSim';
import VelocityEst from '../components/Acoustic/VelocityEst';
import SubMarineDetect from '../components/Acoustic/SubMarineDetect';

function Acoustic() {
  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="acoustic-page">
      {/* SECTION 1: INTRO */}
      <section className="acoustic-intro" id="intro-id">
        <div className="intro-left">
          <div className="doppler-scene">
            <div className="sound-waves">
              <span className="wave w1"></span>
              <span className="wave w2"></span>
              <span className="wave w3"></span>
            </div>
            <div className="moving-car">
              <FaCarSide className="car-icon" />
            </div>
          </div>
          <div className="intro-text">
            <h1>Acoustic Analysis</h1>
            <p>Experience how motion changes sound with simulation. Analyze real audio to estimate speed and detect vehicles.</p>
          </div>
        </div>

        <div className="intro-right">
          <div className="nav-cards-container">
            <div className="nav-card" onClick={() => scrollToSection('section-sim')}>
              <div className="icon-box"><FaCarSide /></div>
              <div className="card-info">
                <h3>Doppler Simulation</h3>
                <p>Generate passing vehicle sounds.</p>
              </div>
              <FaArrowDown className="go-icon"/>
            </div>
            <div className="nav-card" onClick={() => scrollToSection('section-est')}>
              <div className="icon-box"><FaWaveSquare /></div>
              <div className="card-info">
                <h3>Doppler Estimation</h3>
                <p>Calculate velocity from real audio.</p>
              </div>
              <FaArrowDown className="go-icon"/>
            </div>
            <div className="nav-card" onClick={() => scrollToSection('section-submarine')}>
              <div className="icon-box"><FaRobot /></div>
              <div className="card-info">
                <h3>SubMarine Detection</h3>
                <p>Identify unmanned vehicles via AI.</p>
              </div>
              <FaArrowDown className="go-icon"/>
            </div>
          </div>
        </div>
      </section>

      {/* RENDER SUB-TASKS */}
      <DopplerSim />
      <VelocityEst />
      <SubMarineDetect />
    </div>
  );
}

export default Acoustic;