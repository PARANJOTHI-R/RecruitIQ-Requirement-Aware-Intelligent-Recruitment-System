import React, { useState, useEffect } from 'react';
import { getCandidateInsights } from '../services/api';
import FollowUpChat from './FollowUpChat';

function AIInsights({ candidateId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);

  const handleToggle = async () => {
    if (!isExpanded && !insights && !isLoading) {
      // First time opening, fetch insights
      setIsLoading(true);
      setError(null);
      try {
        const result = await getCandidateInsights(candidateId);
        if (result.status === "ok") {
          setInsights(result);
          setChatHistory(result.conversation || []);
        } else {
          setError(result.reason || result.message || "AI insights are currently unavailable.");
        }
      } catch (err) {
        setError(err.message || "AI insights are currently unavailable.");
      } finally {
        setIsLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const renderList = (items) => {
    if (!items || items.length === 0) return <p className="text-sm text-muted">None identified.</p>;
    return (
      <ul style={{ paddingLeft: '1.25rem', margin: 0 }} className="text-sm">
        {items.map((item, idx) => <li key={idx} style={{ marginBottom: '0.25rem' }}>{item}</li>)}
      </ul>
    );
  };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <button 
        className="btn btn-secondary" 
        onClick={handleToggle}
        disabled={isLoading}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}
      >
        <span>{isLoading ? 'Generating insights...' : (isExpanded ? 'Hide AI Insights ▲' : 'See AI Insights ▼')}</span>
      </button>

      {isExpanded && (
        <div style={{ 
          marginTop: '1rem', 
          padding: '1.5rem', 
          backgroundColor: 'white', 
          border: '1px solid var(--border-color)', 
          borderRadius: 'var(--border-radius)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--primary-color)' }}>AI Insights</h3>
          
          {error ? (
            <div className="text-muted">
              <p>{error}</p>
              <p className="text-sm">Your screening results are still available.</p>
            </div>
          ) : insights ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h4 className="text-sm text-secondary" style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>Candidate Summary</h4>
                <p className="text-sm">{insights.candidate_summary}</p>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <h4 className="text-sm text-secondary" style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>Key Strengths</h4>
                  {renderList(insights.key_strengths)}
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <h4 className="text-sm text-secondary" style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>Skill Gaps</h4>
                  {renderList(insights.skill_gaps)}
                </div>
              </div>

              <div>
                <h4 className="text-sm text-secondary" style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>Experience Relevance</h4>
                <p className="text-sm">{insights.experience_relevance}</p>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <h4 className="text-sm text-secondary" style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>Potential Concerns</h4>
                  {renderList(insights.potential_concerns)}
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <h4 className="text-sm text-secondary" style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>Interview Focus Areas</h4>
                  {renderList(insights.interview_focus_areas)}
                </div>
              </div>

              <div>
                <h4 className="text-sm text-secondary" style={{ textTransform: 'uppercase', marginBottom: '0.5rem' }}>Match Quality Explanation</h4>
                <p className="text-sm">{insights.match_quality_explanation}</p>
              </div>

              <FollowUpChat candidateId={candidateId} initialChatHistory={chatHistory} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default AIInsights;
