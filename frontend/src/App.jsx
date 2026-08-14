import React, { useState } from 'react';
import Header from './components/Header';
import ScreeningForm from './components/ScreeningForm';
import ScreeningResults from './components/ScreeningResults';
import { processScreening } from './services/api';

function App() {
  const [screenState, setScreenState] = useState('INITIAL'); // INITIAL, PROCESSING, SUCCESS, ERROR
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleScreeningSubmit = async (formData) => {
    setScreenState('PROCESSING');
    setError(null);
    try {
      const data = await processScreening(formData);
      setResults(data);
      setScreenState('SUCCESS');
    } catch (err) {
      setError(err.message);
      setScreenState('ERROR');
    }
  };

  const handleNewScreening = () => {
    setScreenState('INITIAL');
    setResults(null);
    setError(null);
  };

  return (
    <div className="app-container">
      <Header onNewScreening={screenState === 'SUCCESS' || screenState === 'ERROR' ? handleNewScreening : undefined} />
      
      <main className="main-content">
        {screenState === 'INITIAL' || screenState === 'PROCESSING' ? (
          <div>
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Upload a job description and resumes</h2>
              <p className="text-muted">to begin candidate screening and ranking.</p>
            </div>
            
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
              <ScreeningForm 
                onSubmit={handleScreeningSubmit} 
                isProcessing={screenState === 'PROCESSING'} 
              />
            </div>
          </div>
        ) : screenState === 'ERROR' ? (
          <div className="card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="card-body">
              <h3 style={{ color: 'var(--error-color)', marginBottom: '1rem' }}>Screening Failed</h3>
              <p className="text-secondary mb-4">{error}</p>
              <button className="btn btn-primary" onClick={handleNewScreening}>Try Again</button>
            </div>
          </div>
        ) : screenState === 'SUCCESS' && results ? (
          <ScreeningResults results={results} />
        ) : null}
      </main>
    </div>
  );
}

export default App;
