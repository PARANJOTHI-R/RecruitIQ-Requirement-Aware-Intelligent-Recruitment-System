import React from 'react';

function Header({ onNewScreening }) {
  return (
    <header style={{
      backgroundColor: 'var(--surface-color)',
      borderBottom: '1px solid var(--border-color)',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem'
    }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-color)' }}>
          ATS <span style={{ color: 'var(--text-primary)' }}>| Recruitment Screening</span>
        </h1>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
          Intelligent candidate screening and ranking
        </div>
      </div>
      
      {onNewScreening && (
        <button 
          className="btn btn-secondary" 
          onClick={onNewScreening}
        >
          New Screening
        </button>
      )}
    </header>
  );
}

export default Header;
