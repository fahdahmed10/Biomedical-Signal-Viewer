import React, { useState } from 'react';
import EEGIntro from '../components/EEG/Intro/EEGIntro'; 
import EEGNavbar from '../components/EEG/Dashboard/EEGNavbar'; 
import ContinuousViewer from '../components/EEG/Viewers/ContinuousViewer';
import ReoccurrenceViewer from '../components/EEG/Viewers/ReoccurrenceViewer';
import PolarViewer from '../components/EEG/Viewers/PolarViewer'; 
import '../styles/eeg/eeg-intro.css'; 
import XORViewer from '../components/EEG/Viewers/XORViewer';

function EEG() {
  const [isLaunched, setIsLaunched] = useState(false);
  const [activeView, setActiveView] = useState('continuous');
  const [fileId, setFileId] = useState(null);
  const [eegMetadata, setEegMetadata] = useState(null);
  const [showNotification, setShowNotification] = useState(false);

  const handleFileUploadSuccess = (responseData) => {
    setFileId(responseData.file_id);
    
    // Correctly extracting the dictionaries from the JSON response
    setEegMetadata({
      features: responseData.features,
      predictions: responseData.predictions, // Keeps original just in case
      mlPredictions: responseData.predictions?.ML_Predictions || {}, // Extracted ML Predictions dictionary
      dlPredictions: responseData.predictions?.DL_Predictions || {}  // Extracted DL Predictions dictionary
    });
    
    setIsLaunched(true);
    setShowNotification(true); // Trigger the AI result notification
  };

  const handleBackToIntro = () => {
    setIsLaunched(false);
    setShowNotification(false);
  };

  // Helper function to find the prediction with the highest probability
  const getTopPrediction = (predictionsDict) => {
    if (!predictionsDict || Object.keys(predictionsDict).length === 0) return null;
    
    return Object.entries(predictionsDict).reduce((max, [label, value]) => {
      return value > max.value ? { label, value } : max;
    }, { label: 'Unknown', value: -1 });
  };

  // Get the top result from DL_Predictions to show in the banner
  const topPrediction = eegMetadata ? getTopPrediction(eegMetadata.dlPredictions) : null;
  // Treating "Other" as the baseline/normal class based on typical EEG datasets
  const isNormal = topPrediction?.label === 'Other';

  return (
    <div className="eeg-page-container">
      {!isLaunched ? (
        <EEGIntro onLaunch={handleFileUploadSuccess} />
      ) : (
        <div className="eeg-dashboard-layout">
          
          {/* Mandatory AI Notification Banner */}
          {showNotification && topPrediction && (
            <div className={`ai-notification-banner ${isNormal ? 'normal' : 'abnormal'}`}>
              <div className="notification-content">
                <strong>AI Analysis Result:</strong> {isNormal ? '✅ Normal / Background' : `⚠️ Abnormal Detected: ${topPrediction.label}`} 
                {' '}(Confidence: {(topPrediction.value * 100).toFixed(1)}%)
                <button className="close-notify" onClick={() => setShowNotification(false)}>×</button>
              </div>
            </div>
          )}

          <EEGNavbar 
            activeView={activeView} 
            setActiveView={setActiveView} 
            onBack={handleBackToIntro} 
          />
          
          <div className="eeg-viewers-container">
            
            {activeView === 'continuous' && (
              <div className="eeg-viewer-content" style={{ width: '100%', height: '100%' }}>
                <ContinuousViewer 
                  fileId={fileId} 
                  metadata={eegMetadata} 
                  mlPredictions={eegMetadata?.mlPredictions}
                  dlPredictions={eegMetadata?.dlPredictions}
                />
              </div>
            )}
            
            {activeView === 'reoccurrence' && (
              <div className="eeg-viewer-content" style={{ width: '100%', height: '100%' }}>
                <ReoccurrenceViewer 
                  fileId={fileId} 
                  metadata={eegMetadata} 
                  mlPredictions={eegMetadata?.mlPredictions}
                  dlPredictions={eegMetadata?.dlPredictions}
                />
              </div>
            )}

            {/* INTEGRATED POLAR VIEWER */}
            {activeView === 'polar' && (
              <div className="eeg-viewer-content" style={{ width: '100%', height: '100%' }}>
                <PolarViewer 
                  fileId={fileId} 
                  metadata={eegMetadata} 
                  mlPredictions={eegMetadata?.mlPredictions}
                  dlPredictions={eegMetadata?.dlPredictions}
                />
              </div>
            )}

            {/* INTEGRATED XOR VIEWER */}
            {activeView === 'xor' && (
              <div className="eeg-viewer-content" style={{ width: '100%', height: '100%' }}>
                <XORViewer 
                  fileId={fileId} 
                  metadata={eegMetadata} 
                  mlPredictions={eegMetadata?.mlPredictions}
                  dlPredictions={eegMetadata?.dlPredictions}
                />
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

export default EEG;