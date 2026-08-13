import React, { useState, useEffect } from 'react';
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

export default function CandidateDrawer({
  candidate,
  jobProfile,
  onClose,
  initialTab = 'breakdown', // 'breakdown' | 'insights'
}) {
  if (!candidate) return null;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [insightsData, setInsightsData] = useState(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [insightError, setInsightError] = useState(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'insights' && !insightsData && !isLoadingInsights) {
      fetchInsights();
    }
  }, [activeTab, candidate.id]);

  const fetchInsights = async () => {
    setIsLoadingInsights(true);
    setInsightError(null);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/insights`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        setInsightsData(data);
      } else {
        setInsightError(data.message || 'Gemini insights are currently unavailable. Ensure GEMINI_API_KEY is configured in your .env file.');
      }
    } catch (err) {
      setInsightError('Network error while retrieving insights: ' + err.message);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingMessage) return;

    const question = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: question }]);
    setIsSendingMessage(true);

    try {
      const res = await fetch(`/api/candidates/${candidate.id}/insights/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
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

  const score = candidate.score || {};
  const validation = candidate.validation || { ok: true, warnings: [], extraction_status: 'ok' };
  const contact = candidate.contact || {};
  const profile = candidate.profile || {};

  const getMatchBadge = (item) => {
    if (item.status === 'MATCH') {
      const mt = (item.match_type || 'exact').toLowerCase();
      if (mt === 'exact') {
        return <span className="chip chip-emerald">[+] Exact Match</span>;
      }
      if (mt === 'normalized') {
        return <span className="chip chip-sky">[+] Normalized Match</span>;
      }
      return (
        <span className="chip chip-purple">
          [+] Semantic Match {item.similarity ? `(${item.similarity.toFixed(2)})` : ''}
        </span>
      );
    }
    return <span className="chip chip-rose">[-] Missing</span>;
  };

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="drawer-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="rank-badge rank-1">#{candidate.rank}</span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {candidate.name}
              </h2>
              <span className="score-pill score-high" style={{ fontSize: '1.05rem' }}>
                {score.overall_score?.toFixed(1)}% Overall Fit
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span>Resume: <strong>{candidate.filename}</strong></span>
              <span>Parse Method: <strong>{candidate.parse_method}</strong></span>
              {contact.email && (
                <a href={`mailto:${contact.email}`} style={{ color: 'var(--primary-600)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Mail size={13} /> {contact.email}
                </a>
              )}
              {contact.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={13} /> {contact.phone}
                </span>
              )}
              {contact.linkedin && (
                <a href={contact.linkedin} target="_blank" rel="noreferrer" style={{ color: '#0077b5', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <LinkedInIcon size={13} /> LinkedIn
                </a>
              )}
              {contact.github && (
                <a href={contact.github} target="_blank" rel="noreferrer" style={{ color: '#24292e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <GitHubIcon size={13} /> GitHub
                </a>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Sub-tabs */}
        <div style={{ padding: '0 28px', background: '#ffffff', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: '20px' }}>
            <button
              onClick={() => setActiveTab('breakdown')}
              style={{
                padding: '12px 4px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'breakdown' ? '3px solid var(--primary-600)' : '3px solid transparent',
                color: activeTab === 'breakdown' ? 'var(--primary-600)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Cpu size={16} />
              <span>ATS Match & Evidence Breakdown</span>
            </button>

            <button
              onClick={() => setActiveTab('insights')}
              style={{
                padding: '12px 4px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'insights' ? '3px solid var(--primary-600)' : '3px solid transparent',
                color: activeTab === 'insights' ? 'var(--primary-600)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={16} />
              <span>Gemini AI Insights & Recruiter Q&A</span>
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {activeTab === 'breakdown' && (
            <div>
              {/* Parser Quality Warning if Degraded */}
              {!validation.ok && (
                <div
                  style={{
                    background: 'var(--amber-bg)',
                    border: '1px solid var(--amber-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 18px',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--amber-text)', fontWeight: 800, fontSize: '0.85rem' }}>
                    <AlertTriangle size={16} />
                    <span>PARSER QUALITY: {validation.extraction_status?.toUpperCase()}</span>
                  </div>
                  <ul style={{ marginTop: '8px', paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--amber-text)' }}>
                    {validation.warnings?.map((w, idx) => (
                      <li key={idx}>[!] {w}</li>
                    ))}
                  </ul>
                  <div style={{ fontSize: '0.75rem', marginTop: '6px', color: 'var(--amber-text)', fontStyle: 'italic' }}>
                    Note: Parser quality is degraded. Score may not reflect true candidate profile. Manual review recommended.
                  </div>
                </div>
              )}

              {/* Scoring Weights Breakdown */}
              <div className="section-box">
                <div className="section-box-title">
                  <Award size={16} color="var(--primary-600)" />
                  <span>ATS Scoring Matrix (Deterministic)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', textAlign: 'center' }}>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Required Skills (50%)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--emerald-text)' }}>
                      {score.required_skill_fit?.toFixed(1)}%
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Preferred Skills (20%)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--sky-text)' }}>
                      {score.preferred_skill_fit?.toFixed(1)}%
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Experience Fit (30%)</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-600)' }}>
                      {score.experience_fit !== null && score.experience_fit !== undefined
                        ? `${score.experience_fit.toFixed(1)}%`
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Candidate Extracted Profile */}
              <div className="section-box">
                <div className="section-box-title">
                  <User size={16} color="var(--primary-600)" />
                  <span>Candidate Profile & Detected Skills</span>
                </div>
                <div style={{ fontSize: '0.85rem', marginBottom: '10px' }}>
                  <strong>Experience:</strong> {profile.experience_years !== null && profile.experience_years !== undefined ? `${profile.experience_years} years` : 'Unknown'}
                  {profile.internship_years !== null && profile.internship_years !== undefined && ` | Internships: ${profile.internship_years} years`}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {profile.skills?.map((skill, idx) => (
                    <span key={idx} className="chip chip-slate" style={{ fontSize: '0.78rem' }}>
                      {skill}
                    </span>
                  ))}
                  {(!profile.skills || profile.skills.length === 0) && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>No technical skills detected</span>
                  )}
                </div>
              </div>

              {/* Semantic Matching */}
              <div className="section-box">
                <div className="section-box-title">
                  <Brain size={16} color="var(--purple-main)" />
                  <span>Semantic Matching (MiniLM Cosine Embeddings)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Candidate ↔ Job Semantic Similarity:</span>
                  <span className="chip chip-purple" style={{ fontWeight: 800 }}>
                    {candidate.semantic_similarity?.toFixed(1)}%
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                  Skill-level threshold: <strong>0.55</strong> | False-positive guards active (e.g. Java ↔ JavaScript, React ↔ React Native).
                </div>
              </div>

              {/* Required Skills Match Breakdown */}
              <div className="section-box">
                <div className="section-box-title" style={{ color: 'var(--emerald-text)' }}>
                  <CheckCircle2 size={16} />
                  <span>Required Skills Matching ({score.required_results?.length || 0})</span>
                </div>
                <div>
                  {score.required_results?.map((item, idx) => (
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {item.status === 'MATCH' ? '✓' : '✗'} {item.skill}
                        </span>
                        {getMatchBadge(item)}
                      </div>
                      {item.evidence && (
                        <div className="evidence-quote">
                          <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>Evidence: </span>
                          "{item.evidence}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Preferred Skills Match Breakdown */}
              <div className="section-box">
                <div className="section-box-title" style={{ color: 'var(--sky-text)' }}>
                  <CheckCircle2 size={16} />
                  <span>Preferred Skills Matching ({score.preferred_results?.length || 0})</span>
                </div>
                <div>
                  {score.preferred_results?.map((item, idx) => (
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {item.status === 'MATCH' ? '✓' : '✗'} {item.skill}
                        </span>
                        {getMatchBadge(item)}
                      </div>
                      {item.evidence && (
                        <div className="evidence-quote">
                          <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>Evidence: </span>
                          "{item.evidence}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'insights' && (
            <div>
              {isLoadingInsights && (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <Sparkles size={36} color="var(--primary-600)" className="pulse-card" style={{ margin: '0 auto 16px' }} />
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                    Generating Recruiter Insights via Gemini...
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Analyzing candidate strengths, skill gaps, experience relevance, and interview questions.
                  </div>
                </div>
              )}

              {insightError && (
                <div
                  style={{
                    background: 'var(--amber-bg)',
                    border: '1px solid var(--amber-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '20px',
                    textAlign: 'center',
                  }}
                >
                  <AlertTriangle size={28} color="var(--amber-main)" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 700, color: 'var(--amber-text)' }}>AI Insights Unavailable</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--amber-text)', marginTop: '6px' }}>
                    {insightError}
                  </div>
                  <button
                    onClick={fetchInsights}
                    className="btn btn-accent btn-sm"
                    style={{ marginTop: '14px' }}
                  >
                    Retry Insights Generation
                  </button>
                </div>
              )}

              {insightsData && !isLoadingInsights && (
                <div>
                  {/* Candidate Summary */}
                  <div className="section-box">
                    <div className="section-box-title">
                      <Sparkles size={16} color="var(--primary-600)" />
                      <span>Executive Recruiter Summary</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                      {insightsData.candidate_summary}
                    </p>
                  </div>

                  {/* Strengths & Gaps Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '22px' }}>
                    <div style={{ background: 'var(--emerald-bg)', border: '1px solid var(--emerald-border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--emerald-text)', marginBottom: '8px' }}>
                        Key Strengths
                      </div>
                      <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--emerald-text)' }}>
                        {insightsData.key_strengths?.map((s, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ background: 'var(--rose-bg)', border: '1px solid var(--rose-border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--rose-text)', marginBottom: '8px' }}>
                        Skill Gaps & Missing Reqs
                      </div>
                      <ul style={{ paddingLeft: '18px', fontSize: '0.82rem', color: 'var(--rose-text)' }}>
                        {insightsData.skill_gaps?.map((g, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Experience Relevance & Concerns */}
                  <div className="section-box">
                    <div className="section-box-title">
                      <span>Experience Alignment & Potential Concerns</span>
                    </div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '10px' }}>
                      <strong>Alignment:</strong> {insightsData.experience_relevance}
                    </div>
                    {insightsData.potential_concerns?.length > 0 && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--amber-text)' }}>
                        <strong>Risks / Notes:</strong>
                        <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                          {insightsData.potential_concerns.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Interview Focus Areas */}
                  <div className="section-box">
                    <div className="section-box-title">
                      <HelpCircle size={16} color="var(--primary-600)" />
                      <span>Recommended Interview Focus Questions</span>
                    </div>
                    <ul style={{ paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      {insightsData.interview_focus_areas?.map((q, i) => (
                        <li key={i} style={{ marginBottom: '8px' }}>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Interactive Q&A Copilot */}
                  <div className="section-box">
                    <div className="section-box-title">
                      <MessageSquare size={16} color="var(--primary-600)" />
                      <span>Interactive Recruiter Q&A Copilot</span>
                    </div>

                    <div style={{ minHeight: '120px', maxHeight: '240px', overflowY: 'auto', marginBottom: '14px' }}>
                      {chatMessages.length === 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                          Ask specific follow-up questions about this candidate (e.g. "Does this candidate have experience with REST APIs and databases?").
                        </div>
                      )}
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`chat-bubble ${msg.role === 'user' ? 'chat-user' : 'chat-ai'}`}
                        >
                          <strong>{msg.role === 'user' ? 'You: ' : 'Gemini: '}</strong>
                          {msg.content}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ask a question about this candidate's fit..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={isSendingMessage}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.85rem',
                          background: '#ffffff',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={isSendingMessage || !chatInput.trim()}
                        className="btn btn-primary btn-sm"
                      >
                        <Send size={15} />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
