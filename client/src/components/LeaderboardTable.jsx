import React, { useState } from 'react';
import {
  Search,
  SlidersHorizontal,
  Download,
  Eye,
  Sparkles,
  AlertTriangle,
  Mail,
  Phone,
  Clock,
  Clock3
} from 'lucide-react';
import { LinkedInIcon, GitHubIcon } from './Icons';
import { formatScore } from '../utils';

export default function LeaderboardTable({
  submissions = [],
  onSelectCandidate,
  onOpenInsights,
  jobTitle = 'Target Role',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [onlyReviewWarnings, setOnlyReviewWarnings] = useState(false);

  const screenedSubmissions = submissions.filter(s => s.screening?.status === 'screened');
  const unscreenedSubmissions = submissions.filter(s => s.screening?.status !== 'screened');

  const filteredScreened = screenedSubmissions.filter((sub) => {
    const nameMatch = sub.candidate?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const fileMatch = sub.original_filename?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = nameMatch || fileMatch;

    const matchesScore = (sub.screening.analysis?.overall_score || 0) >= minScore;

    const matchesWarning = onlyReviewWarnings
      ? sub.parser?.status !== 'ok'
      : true;

    return matchesSearch && matchesScore && matchesWarning;
  });

  // Rank screened candidates
  const rankedScreened = [...filteredScreened].sort((a, b) => 
     (b.screening.analysis?.overall_score || 0) - (a.screening.analysis?.overall_score || 0)
  );

  const exportCSV = () => {
    if (!submissions.length) return;
    const headers = [
      'Status',
      'Rank',
      'Candidate Name',
      'Overall Score (%)',
      'Required Skill Fit (%)',
      'Preferred Skill Fit (%)',
      'Experience Fit (%)',
      'Experience (Years)',
      'Parse Method',
      'Parser Status',
      'Email',
      'Phone',
      'Filename',
    ];

    const rows = submissions.map((sub, idx) => {
      const isScreened = sub.screening?.status === 'screened';
      const sa = sub.screening?.analysis || {};
      return [
        isScreened ? 'Screened' : 'Not Screened',
        isScreened ? idx + 1 : 'N/A', // approximate rank
        `"${sub.candidate?.name || ''}"`,
        isScreened ? formatScore(sa.overall_score || 0) : 'N/A',
        isScreened ? formatScore(sa.required_skill_score || 0) : 'N/A',
        isScreened ? formatScore(sa.preferred_skill_score || 0) : 'N/A',
        isScreened ? formatScore(sa.experience_score || 0) : 'N/A',
        sa.experience_years !== undefined ? sa.experience_years : 'Unknown',
        sub.parser?.method || 'unknown',
        sub.parser?.status || 'unknown',
        sub.candidate?.email || '',
        sub.candidate?.phone || '',
        `"${sub.original_filename || ''}"`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `RecruitIQ_Screening_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getScoreClass = (score) => {
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-med';
    if (score >= 30) return 'score-low';
    return 'score-poor';
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="rank-badge rank-1">🥇 1</span>;
    if (rank === 2) return <span className="rank-badge rank-2">🥈 2</span>;
    if (rank === 3) return <span className="rank-badge rank-3">🥉 3</span>;
    return <span className="rank-badge rank-other">#{rank}</span>;
  };

  const renderCandidateInfo = (sub) => (
    <div>
      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
        {sub.candidate?.name || "Unknown Candidate"}
      </div>
      <div
        style={{
          fontSize: '0.78rem',
          color: 'var(--text-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '4px',
        }}
      >
        <span>{sub.original_filename}</span>
        {sub.candidate?.email && (
          <a href={`mailto:${sub.candidate.email}`} title={sub.candidate.email} style={{ color: 'var(--text-muted)' }}>
            <Mail size={13} />
          </a>
        )}
        {sub.candidate?.phone && (
          <a href={`tel:${sub.candidate.phone}`} title={sub.candidate.phone} style={{ color: 'var(--text-muted)' }}>
            <Phone size={13} />
          </a>
        )}
      </div>
    </div>
  );

  return (
    <div className="table-container">
      {/* Table Controls & Filter Bar */}
      <div
        style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          background: '#ffffff',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Candidate Screening Leaderboard
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Showing {rankedScreened.length} screened profiles
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-light)',
              }}
            />
            <input
              type="text"
              placeholder="Search candidate..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '8px 14px 8px 36px',
                fontSize: '0.85rem',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                background: '#f8fafc',
                minWidth: '240px',
              }}
            />
          </div>

          {/* Min Score Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <span>Min Score: <strong>{minScore}%</strong></span>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              style={{ cursor: 'pointer', width: '90px' }}
            />
          </div>

          {/* Export CSV */}
          <button onClick={exportCSV} className="btn btn-secondary btn-sm" title="Export Results to CSV">
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Screened Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Rank</th>
              <th>Candidate</th>
              <th>Overall Score</th>
              <th>Req. Skill Fit</th>
              <th>Pref. Skill Fit</th>
              <th>Experience</th>
              <th>Parser Quality</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rankedScreened.map((sub, idx) => {
              const rank = idx + 1;
              const isFailedParse = sub.parser?.status === 'failed';
              const sa = sub.screening.analysis || {};
              const overallScore = sa.overall_score || 0;
              const reqFit = sa.required_skill_score || 0;
              const prefFit = sa.preferred_skill_score || 0;
              const expYears = sa.experience_years;

              return (
                <tr key={sub.submission_id}>
                  <td>{getRankBadge(rank)}</td>
                  <td>{renderCandidateInfo(sub)}</td>
                  <td>
                    <span className={`score-pill ${getScoreClass(overallScore)}`}>
                      {formatScore(overallScore)}%
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: reqFit >= 60 ? 'var(--emerald-text)' : 'var(--text-main)' }}>
                      {formatScore(reqFit)}%
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {formatScore(prefFit)}%
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {expYears !== null && expYears !== undefined ? `${expYears} yrs` : 'Unknown'}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span className="chip chip-slate" style={{ fontSize: '0.72rem', alignSelf: 'flex-start' }}>
                        {sub.parser?.method || 'unknown'}
                      </span>
                      {isFailedParse && (
                        <span className="chip chip-amber" style={{ fontSize: '0.72rem', alignSelf: 'flex-start' }}>
                          <AlertTriangle size={12} />
                          <span>[!REVIEW]</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => onSelectCandidate(sub)}
                        className="btn btn-secondary btn-sm"
                        title="View complete match evidence and terminal breakdown"
                      >
                        <Eye size={14} />
                        <span>Inspect Match</span>
                      </button>
                      <button
                        onClick={() => onOpenInsights && onOpenInsights(sub)}
                        className="btn btn-accent btn-sm"
                        title="Generate Gemini AI recruiter insights & chat"
                      >
                        <Sparkles size={14} />
                        <span>AI Insights</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {rankedScreened.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No screened candidates match your current filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Not Screened Section */}
      {unscreenedSubmissions.length > 0 && (
        <div style={{ padding: '24px', background: 'var(--bg-subtle)' }}>
           <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
              <Clock3 size={18} />
              Awaiting Screening ({unscreenedSubmissions.length})
           </h3>
           <table className="custom-table" style={{ background: '#fff', boxShadow: 'none', border: '1px solid var(--border-subtle)' }}>
              <thead>
                <tr>
                   <th>Candidate</th>
                   <th>Submitted</th>
                   <th>Parser Status</th>
                   <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                 {unscreenedSubmissions.map(sub => (
                    <tr key={sub.submission_id}>
                       <td>{renderCandidateInfo(sub)}</td>
                       <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {new Date(sub.submitted_at).toLocaleDateString()}
                       </td>
                       <td>
                          <span className={`chip ${sub.parser?.status === 'ok' ? 'chip-emerald' : sub.parser?.status === 'failed' ? 'chip-rose' : 'chip-amber'}`}>
                             {sub.parser?.status || 'pending'}
                          </span>
                       </td>
                       <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => onSelectCandidate(sub)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Eye size={14} />
                            <span>View Profile</span>
                          </button>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
}
