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
          </div>
          <div className="brand-tagline">
            Requirement-Aware Intelligent Recruitment & Ranking System
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        

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
