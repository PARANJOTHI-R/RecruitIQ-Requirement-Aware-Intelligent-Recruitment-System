import React from 'react';
import { Layers, Sparkles, CheckCircle2, RefreshCw, FileText, Zap } from 'lucide-react';

export default function Header({ onQuickDemo, onReset, isScreening, resultsCount }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">
          <Layers size={24} />
        </div>
        <div>
          <div className="brand-title">
            RecruitIQ
            <span className="brand-badge">ATS Engine v2.0</span>
          </div>
          <div className="brand-tagline">
            Requirement-Aware Intelligent Recruitment & Ranking System
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="chip chip-emerald" style={{ padding: '6px 12px' }}>
          <CheckCircle2 size={14} />
          <span>Semantic AI Ready</span>
        </div>

        <button 
          onClick={onQuickDemo} 
          disabled={isScreening}
          className="btn btn-accent btn-sm"
          title="Run 1-click screening with sample JD and 13 demo resumes"
        >
          <Zap size={14} />
          <span>1-Click Full Demo</span>
        </button>

        {(resultsCount > 0) && (
          <button 
            onClick={onReset}
            disabled={isScreening}
            className="btn btn-secondary btn-sm"
            title="Reset and start new screening"
          >
            <RefreshCw size={14} />
            <span>Reset</span>
          </button>
        )}
      </div>
    </header>
  );
}
