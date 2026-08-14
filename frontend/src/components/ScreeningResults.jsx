import React from 'react';
import CandidateCard from './CandidateCard';

function ScreeningResults({ results }) {
  if (!results || !results.candidates || results.candidates.length === 0) {
    return (
      <div className="card text-center p-8">
        <div className="card-body">
          <p className="text-muted">No valid candidates were returned from the screening process.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Screening Results</h2>
        <div className="text-sm text-secondary">
          {results.successful_count} candidates screened
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {results.candidates.map(candidate => (
          <CandidateCard key={candidate.id} candidate={candidate} />
        ))}
      </div>
    </div>
  );
}

export default ScreeningResults;
