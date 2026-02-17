import { NavLink } from 'react-router-dom';
import { LiaFileMedicalAltSolid } from "react-icons/lia";
import './Navbar.css';

function Navbar() {
  return (
    <nav className="navbar">
      {/* This container keeps everything centered and not too wide */}
      <div className="navbar-container">
        
        {/* LEFT SIDE */}
        <div className="navbar-brand">
          <LiaFileMedicalAltSolid className="navbar-icon" />
          <span className="navbar-title">Signals Viewer</span>
        </div>

        {/* RIGHT SIDE (Home is here now for better alignment) */}
        <div className="navbar-links">
          <NavLink to="/" className="nav-link">Home</NavLink>
          <NavLink to="/ecg" className="nav-link">ECG</NavLink>
          <NavLink to="/eeg" className="nav-link">EEG</NavLink>
          <NavLink to="/acoustic" className="nav-link">Acoustic</NavLink>
          <NavLink to="/microbiome" className="nav-link">Microbiome</NavLink>
          <NavLink to="/stock" className="nav-link">Stock</NavLink>
        </div>

      </div>
    </nav>
  );
}

export default Navbar;