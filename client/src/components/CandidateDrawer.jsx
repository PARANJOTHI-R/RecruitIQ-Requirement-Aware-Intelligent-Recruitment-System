import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Mail,
  Phone,
  Award,
  Cpu,
  Brain,
  MessageSquare,
  Send,
  HelpCircle,
  Quote,
} from 'lucide-react';
import { LinkedInIcon, GitHubIcon } from './Icons';
import { formatScore } from '../utils';

export default function CandidateDrawer({
  candidate: submission,
  jobProfile,
  onClose,
  initialTab = 'breakdown', // 'breakdown' | 'insights'
}) {
  const submissionId = submission?.submission_id;
  const isScreened = submission?.screening?.status === 'screened';
  const sa = submission?.screening?.analysis || {};
  const matches = submission?.screening?.skill_matches || [];
  const contact = submission?.candidate || {};
  const analysisId = sa?.analysis_id;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [insightsData, setInsightsData] = useState(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightError, setInsightError] = useState(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Evidence Expanded State
  const [expandedSkills, setExpandedSkills] = useState({});
  const toggleSkill = (idx) => {
    setExpandedSkills(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    // Reset all candidate-specific state on candidate change (belt-and-suspenders)
    setInsightsData(null);
    setInsightError(null);
    setIsLoadingInsights(false);
    setChatMessages([]);
    setActiveTab(initialTab);
    setExpandedSkills({});
  }, [submissionId, initialTab]);

  useEffect(() => {
    if (!submission || !isScreened) return;
    if (activeTab === 'insights' && !insightsData && !isLoadingInsights && analysisId) {
      fetchInsights();
    }
  }, [activeTab, submissionId, insightsData, isLoadingInsights, isScreened, analysisId]);

  const fetchInsights = async () => {
    const requestedId = submissionId; // capture at call time for stale-check
    setIsLoadingInsights(true);
    setInsightError(null);
    try {
      const res = await fetch(`/api/ai/insights/${analysisId}`, { method: 'POST' });
      const data = await res.json();

      if (requestedId !== submissionId) return; // stale — different candidate selected

      if (res.ok && res.status === 200 && data.success) {
        // Cache hit — immediate result, no polling needed
        setInsightsData(data.insight?.insight_data || data.insight);
        return;
      }

      if (res.status === 202 && data.jobId) {
        // Job enqueued — poll for completion (polling manages its own loading state reset)
        await pollInsightJob(data.jobId, requestedId);
        return;
      }

      setInsightError(data.message || 'Gemini insights are currently unavailable.');
    } catch (err) {
      if (requestedId !== submissionId) return;
      setInsightError('Network error while retrieving insights: ' + err.message);
    } finally {
      if (requestedId !== submissionId) return;
      setIsLoadingInsights(false);
    }
  };

  // Poll GET /api/ai/insights/job/:jobId every 2s, up to 90s.
  // Called inside fetchInsights try-block; fetchInsights finally resets loading state.
  const pollInsightJob = async (jobId, requestedId) => {
    const MAX_POLLS = 45;    // 45 * 2s = 90s
    const INTERVAL_MS = 2000;

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));

      if (requestedId !== submissionId) return; // drawer closed or candidate changed

      try {
        const pollRes = await fetch(`/api/ai/insights/job/${jobId}`);
        const pollData = await pollRes.json();

        if (requestedId !== submissionId) return;

        if (pollData.status === 'complete' && pollData.success) {
          setInsightsData(pollData.insight?.insight_data || pollData.insight);
          return;
        }

        if (pollData.status === 'failed') {
          setInsightError(pollData.error || 'AI insights generation failed. Please try again.');
          return;
        }

        if (pollData.status === 'not_started') {
          // Server restarted mid-job; job dropped. Let the user re-trigger.
          setInsightError('Job lost (server restarted). Click the Insights tab again to retry.');
          return;
        }
        // status === 'pending' | 'processing' — keep polling
      } catch (_) {
        // Network hiccup during poll — continue
      }
    }

    if (requestedId === submissionId) {
      setInsightError('Insight generation timed out (90s). Please try again.');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingMessage || !analysisId) return;

    const question = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: question }]);
    setIsSendingMessage(true);

    try {
      const res = await fetch(`/api/ai/chat/${analysisId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, conversation: chatMessages }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChatMessages((prev) => [...prev, { role: 'model', content: data.answer }]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: 'model', content: `⚠️ ${data.message || 'Unable to generate answer at this time.'}` },
        ]);
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        { role: 'model', content: `⚠️ Network error: ${err.message}` },
      ]);
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (!submission) return null;

  const getMatchBadge = (item) => {
    if (item.matched) {
      const mt = (item.match_type || 'exact').toLowerCase();
      if (mt === 'exact') return <span className="chip chip-emerald">[+] Exact Match</span>;
      if (mt === 'normalized') return <span className="chip chip-sky">[+] Normalized Match</span>;
      return <span className="chip chip-purple">[+] Semantic Match {item.similarity_score ? `(${Number(item.similarity_score).toFixed(2)})` : ''}</span>;
    }
    return <span className="chip chip-rose">[-] Missing</span>;
  };

  const renderSkillItem = (item, idx) => {
    const isExpanded = !!expandedSkills[idx];
    const isMatched = item.matched;
    
    return (
      <div
        key={idx}
        style={{
          padding: '12px',
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: isMatched ? '#dcfce7' : '#ffe4e6',
              color: isMatched ? '#16a34a' : '#e11d48'
            }}>
              {isMatched ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
            </span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              {item.skill_name}
            </span>
            {getMatchBadge(item)}
          </div>
          {item.evidence && (
            <button
              onClick={() => toggleSkill(idx)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
            >
              {isExpanded ? 'Hide Evidence' : 'Show Evidence'}
            </button>
          )}
        </div>
        
        {isExpanded && item.evidence && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            background: 'var(--bg-subtle)',
            borderLeft: `3px solid ${isMatched ? 'var(--emerald-border)' : 'var(--border-subtle)'}`,
            borderRadius: '0 4px 4px 0',
            fontSize: '0.85rem',
            color: 'var(--text-main)',
            fontFamily: 'var(--font-mono)'
          }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <Quote size={14} style={{ color: 'var(--text-muted)' }} />
              <strong style={{ color: 'var(--text-subtle)' }}>Extracted Evidence:</strong>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', paddingLeft: '22px' }}>
              {item.evidence}
            </div>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <>
      {/* Overlay */}
      <div 
        className="drawer-overlay"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className={`drawer-container open`}>
        {/* Header */}
        <div className="drawer-header">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Note: Rank is assumed 1 if not provided, you might need to pass rank if available */}
              <span style={{
                background: '#fde68a', color: '#b45309', padding: '4px 8px', borderRadius: '50%', fontWeight: 800, fontSize: '0.85rem'
              }}>#{submission.rank || 1}</span>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>
                {contact.name || 'Unknown Candidate'}
              </h2>
              {sa?.overall_score && (
                <span className="chip chip-emerald" style={{ fontWeight: 600 }}>
                  {formatScore(sa.overall_score)}% Overall Fit
                </span>
              )}
              {submission.parser?.status === 'failed' && (
                <span className="chip chip-amber" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} />
                  Parser Issues
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-subtle)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Resume:</span> <strong style={{ color: 'var(--text-main)' }}>{submission.original_filename || 'Unknown.pdf'}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Parse Method:</span> <strong style={{ color: 'var(--text-main)' }}>{submission.parser_method || submission.parser?.method || 'linear_fallback'}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-subtle)', flexWrap: 'wrap' }}>
              {contact.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={14} /> {contact.phone}
                </span>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary-600)', textDecoration: 'none' }}>
                  <Mail size={14} /> {contact.email}
                </a>
              )}
              {contact.linkedin && (
                <a href={contact.linkedin} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0077b5', textDecoration: 'none' }}>
                  <LinkedInIcon size={14} /> LinkedIn
                </a>
              )}
              {contact.github && (
                <a href={contact.github} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#333', textDecoration: 'none' }}>
                  <GitHubIcon size={14} /> GitHub
                </a>
              )}
            </div>
          </div>
          
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {!isScreened ? (
           <div className="drawer-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', color: 'var(--text-muted)' }}>
              <User size={48} style={{ color: 'var(--border-strong)' }} />
              <h3>Candidate has not been screened yet.</h3>
              <p>Close this panel and select "Screen Unscreened" to run the AI analysis.</p>
           </div>
        ) : (
        <>
          {/* Tabs */}
          <div className="drawer-tabs">
            <button
              className={`drawer-tab ${activeTab === 'breakdown' ? 'active' : ''}`}
              onClick={() => setActiveTab('breakdown')}
            >
              <Cpu size={16} />
              Terminal Breakdown
            </button>
            <button
              className={`drawer-tab ${activeTab === 'insights' ? 'active' : ''}`}
              onClick={() => setActiveTab('insights')}
            >
              <Sparkles size={16} />
              AI Recruiter Insights
            </button>
          </div>

          {/* Content Area */}
          <div className="drawer-content">
            
            {/* -------------------- BREAKDOWN TAB -------------------- */}
            {activeTab === 'breakdown' && (
              <div className="tab-pane active">
                
                {/* Score Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div className="card" style={{ padding: '16px', textAlign: 'center', borderTop: '4px solid var(--primary-500)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Overall Score
                    </div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--primary-700)', marginTop: '8px' }}>
                      {formatScore(sa.overall_score)}%
                    </div>
                  </div>
                  
                  <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Required Skills</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatScore(sa.required_skill_score)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Preferred Skills</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatScore(sa.preferred_skill_score)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Experience ({sa.experience_years} yrs)</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatScore(sa.experience_score)}%</span>
                    </div>
                  </div>
                </div>

                {/* Requirements Evidence */}
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={18} style={{ color: 'var(--emerald-500)' }} />
                    Skill Match Evidence
                  </h3>
                  
                  <div>
                    {matches.map((item, idx) => renderSkillItem(item, idx))}
                  </div>
                </div>

              </div>
            )}

            {/* -------------------- INSIGHTS TAB -------------------- */}
            {activeTab === 'insights' && (
              <div className="tab-pane active" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                
                {isLoadingInsights ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <Sparkles className="spin-animation" size={32} style={{ color: 'var(--accent-500)', marginBottom: '16px' }} />
                    <div>Generating Gemini AI Insights...</div>
                  </div>
                ) : insightError ? (
                  <div className="auth-alert error">
                    <AlertTriangle size={20} />
                    <p>{insightError}</p>
                    <button onClick={fetchInsights} className="btn btn-secondary btn-sm" style={{ marginTop: '10px' }}>
                      Retry
                    </button>
                  </div>
                ) : insightsData ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Insights Summary */}
                    <div className="card" style={{ padding: '20px', marginBottom: '24px', background: 'linear-gradient(to right, #fdf4ff, #faf5ff)', border: '1px solid #f3e8ff' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7e22ce', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Brain size={20} />
                        Gemini Summary
                      </h3>
                      <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)', margin: 0 }}>
                        {insightsData.summary}
                      </p>
                    </div>

                    {/* Chat Interface */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: '#ffffff', overflow: 'hidden' }}>
                      
                      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MessageSquare size={16} />
                        Chat with Gemini about {contact.name?.split(' ')[0] || 'this candidate'}
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '300px' }}>
                        {chatMessages.length === 0 && (
                          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <HelpCircle size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                            <p style={{ fontSize: '0.9rem' }}>Ask questions about the candidate's experience, cultural fit, or missing skills.</p>
                          </div>
                        )}
                        
                        {chatMessages.map((msg, i) => (
                          <div key={i} style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            background: msg.role === 'user' ? 'var(--primary-600)' : '#f1f5f9',
                            color: msg.role === 'user' ? '#ffffff' : 'var(--text-main)',
                            borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                            borderBottomLeftRadius: msg.role === 'model' ? '2px' : '12px',
                            fontSize: '0.9rem',
                            lineHeight: '1.5'
                          }}>
                            {msg.role === 'model' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                                <Sparkles size={12} /> Gemini
                              </div>
                            )}
                            {msg.content}
                          </div>
                        ))}
                        
                        {isSendingMessage && (
                          <div style={{ alignSelf: 'flex-start', background: '#f1f5f9', padding: '10px 14px', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            <span className="typing-indicator">...</span>
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleSendMessage} style={{ display: 'flex', padding: '12px', borderTop: '1px solid var(--border-subtle)', background: '#ffffff' }}>
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="e.g. Does she have experience with Docker in production?"
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '20px',
                            outline: 'none',
                            fontSize: '0.9rem'
                          }}
                          disabled={isSendingMessage}
                        />
                        <button
                          type="submit"
                          disabled={isSendingMessage || !chatInput.trim()}
                          style={{
                            background: chatInput.trim() ? 'var(--primary-600)' : 'var(--border-strong)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: '8px',
                            cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                            transition: 'background 0.2s'
                          }}
                        >
                          <Send size={16} style={{ marginLeft: '2px' }} />
                        </button>
                      </form>

                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </>
        )}
      </div>
    </>,
    document.body
  );
}
