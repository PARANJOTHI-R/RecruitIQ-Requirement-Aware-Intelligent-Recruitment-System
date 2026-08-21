import React from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { Layers, Brain, Search, Sparkles, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  const { navigate } = useHashRouter();

  return (
    <div className="page-container">
      <nav className="app-header">
        <div className="brand cursor-pointer" onClick={() => navigate('/')}>
          <div className="brand-icon">
            <Layers size={24} />
          </div>
          <div>
            <div className="brand-title">RecruitIQ</div>
            <div className="brand-tagline">Intelligent ATS</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={() => navigate('/login')} className="btn btn-secondary">Sign In</button>
          <button onClick={() => navigate('/register')} className="btn btn-primary">Get Started</button>
        </div>
      </nav>

      <main className="hero-section">
        <h1 className="hero-title">Recruit smarter. Screen faster. Hire with evidence.</h1>
        <p className="hero-subtitle">
          RecruitIQ helps recruiters analyze job requirements, screen multiple resumes, rank candidates using deterministic matching, and optionally use AI for recruiter assistance.
        </p>
        
        <div className="hero-actions">
          <button onClick={() => navigate('/register')} className="btn btn-primary btn-lg">
            Start Screening
          </button>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="stat-icon indigo" style={{ display: 'inline-block', marginBottom: '1rem' }}>
              <Search size={24} />
            </div>
            <h3>Intelligent Analysis</h3>
            <p>Extract structured requirements from raw job descriptions.</p>
          </div>
          <div className="feature-card">
            <div className="stat-icon emerald" style={{ display: 'inline-block', marginBottom: '1rem' }}>
              <CheckCircle2 size={24} />
            </div>
            <h3>Deterministic Screening</h3>
            <p>Match skills and experience objectively without black-box AI guessing.</p>
          </div>
          <div className="feature-card">
            <div className="stat-icon purple" style={{ display: 'inline-block', marginBottom: '1rem' }}>
              <Brain size={24} />
            </div>
            <h3>Optional AI Insights</h3>
            <p>Request Gemini assistance on-demand for deep candidate Q&A.</p>
          </div>
        </div>
      </main>

      <footer style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-card)' }}>
        &copy; {new Date().getFullYear()} RecruitIQ. All rights reserved.
      </footer>
    </div>
  );
}
