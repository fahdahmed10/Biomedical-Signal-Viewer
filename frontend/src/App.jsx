import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';

// Import your pages
import Home from './pages/Home';
import ECG from './pages/ECG';
import EEG from './pages/EEG';
import Acoustic from './pages/Acoustic';
import Microbiome from './pages/Microbiome';
import Stock from './pages/Stock';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ecg" element={<ECG />} />
        <Route path="/eeg" element={<EEG />} />
        <Route path="/acoustic" element={<Acoustic />} />
        <Route path="/microbiome" element={<Microbiome />} />
        <Route path="/stock" element={<Stock />} />
      </Routes>
    </>
    
  );
}

export default App;