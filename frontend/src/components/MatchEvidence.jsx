import React from 'react';

function MatchEvidence({ scoreResult }) {
  if (!scoreResult) return null;

  const renderMatchList = (title, skillsList) => {
    if (!skillsList || skillsList.length === 0) return null;

    return (
      <div className="mb-4">
        <h4 className="text-sm text-secondary" style={{ marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {skillsList.map((skillObj, idx) => {
            const isMatch = skillObj.status && skillObj.status.toLowerCase() !== 'missing';
            
            return (
              <div key={idx} style={{ 
                padding: '0.75rem', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--border-radius)',
                backgroundColor: isMatch ? 'var(--success-bg)' : '#f8fafc',
                borderLeft: `4px solid ${isMatch ? 'var(--success-color)' : 'var(--error-color)'}`
              }}>
                <div className="flex justify-between items-center mb-2">
                  <span style={{ fontWeight: 600 }}>{skillObj.skill || skillObj.req_skill}</span>
                  <span className={`badge ${isMatch ? 'badge-success' : 'badge-error'}`}>
                    {skillObj.status || 'Missing'}
                  </span>
                </div>
                {skillObj.evidence && skillObj.evidence !== 'None' && (
                  <div className="text-sm text-muted" style={{ fontStyle: 'italic' }}>
                    Evidence: "{skillObj.evidence}"
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
        Match Analysis
      </h3>
      {renderMatchList("Required Skills", scoreResult.required_results)}
      {renderMatchList("Preferred Skills", scoreResult.preferred_results)}
    </div>
  );
}

export default MatchEvidence;
