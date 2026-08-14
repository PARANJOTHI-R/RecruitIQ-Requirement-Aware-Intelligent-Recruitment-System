import React from 'react';

function ScoreBreakdown({ score }) {
  if (!score) return null;

  const formatPercentage = (val) => {
    if (val === null || val === undefined || isNaN(val)) return 'N/A';
    return `${Number(val).toFixed(1)}%`;
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
      <div style={{ 
        flex: '1 1 100px',
        padding: '1rem', 
        backgroundColor: '#f1f5f9', 
        borderRadius: 'var(--border-radius)',
        textAlign: 'center',
        border: '1px solid var(--primary-color)'
      }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-color)' }}>
          {formatPercentage(score.overall_score)}
        </div>
        <div className="text-sm text-secondary font-medium">Overall Match</div>
      </div>
      
      <div style={{ flex: '2 1 200px', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
        <div className="flex justify-between items-center text-sm">
          <span>Required Skills</span>
          <span style={{ fontWeight: 600 }}>{formatPercentage(score.required_skill_fit)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span>Preferred Skills</span>
          <span style={{ fontWeight: 600 }}>{formatPercentage(score.preferred_skill_fit)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span>Experience</span>
          <span style={{ fontWeight: 600 }}>{formatPercentage(score.experience_fit)}</span>
        </div>
      </div>
    </div>
  );
}

export default ScoreBreakdown;
