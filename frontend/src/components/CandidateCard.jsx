import React, { useState } from 'react';
import ScoreBreakdown from './ScoreBreakdown';
import MatchEvidence from './MatchEvidence';
import AIInsights from './AIInsights';

function CandidateCard({ candidate }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { rank, name, contact, score, profile, id } = candidate;
  const isFallback = candidate.parse_method === 'linear_fallback' || (candidate.parser_status === 'failed');

  return (
    <div className="card mb-4">
      <div className="card-header flex justify-between items-center" style={{ backgroundColor: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--primary-color)', 
            color: 'white', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '1.25rem'
          }}>
            #{rank}
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{name}</h3>
            {contact && (contact.email || contact.phone) && (
              <div className="text-sm text-muted">
                {contact.email} {contact.phone && `| ${contact.phone}`}
              </div>
            )}
            {isFallback && (
              <span className="badge badge-warning" style={{ marginTop: '0.25rem' }}>Linear Fallback Parser</span>
            )}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary-color)' }}>
            {score.overall_score != null ? `${Number(score.overall_score).toFixed(1)}%` : 'N/A'}
          </div>
          <div className="text-sm text-secondary">Overall Match</div>
        </div>
      </div>

      <div className="card-body">
        <ScoreBreakdown score={score} />

        <div className="flex justify-end mt-4">
          <button 
            className="btn btn-secondary"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Hide Match Details' : 'View Match Details'}
          </button>
        </div>

        {isExpanded && (
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <MatchEvidence scoreResult={score} />
          </div>
        )}

        <AIInsights candidateId={id} />
      </div>
    </div>
  );
}

export default CandidateCard;
