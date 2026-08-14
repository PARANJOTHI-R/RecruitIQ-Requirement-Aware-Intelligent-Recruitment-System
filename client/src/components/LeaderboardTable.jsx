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
  CheckCircle,
  Award,
  FileCheck,
} from 'lucide-react';
import { LinkedInIcon, GitHubIcon } from './Icons';
import { formatScore } from '../utils';

export default function LeaderboardTable({
  candidates = [],
  onSelectCandidate,
  onOpenInsights,
  jobTitle = 'Target Role',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [minScore, setMinScore] = useState(0);
  const [onlyReviewWarnings, setOnlyReviewWarnings] = useState(false);

  const filteredCandidates = candidates.filter((cand) => {
    const matchesSearch =
      cand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cand.profile?.skills?.some((s) => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
      cand.filename.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesScore = (cand.score?.overall_score || 0) >= minScore;

    const matchesWarning = onlyReviewWarnings
      ? !cand.validation?.ok || cand.validation?.extraction_status !== 'ok'
      : true;

    return matchesSearch && matchesScore && matchesWarning;
  });

  const exportCSV = () => {
    if (!candidates.length) return;

    const headers = [
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

    const rows = candidates.map((c) => [
      c.rank,
      `"${c.name}"`,
      c.score?.overall_score !== undefined ? formatScore(c.score.overall_score) : '0.0',
      c.score?.required_skill_fit !== undefined ? formatScore(c.score.required_skill_fit) : '0.0',
      c.score?.preferred_skill_fit !== undefined ? formatScore(c.score.preferred_skill_fit) : '0.0',
      c.score?.experience_fit !== undefined && c.score?.experience_fit !== null ? formatScore(c.score.experience_fit) : 'N/A',
      c.profile?.experience_years ?? 'Unknown',
      c.parse_method,
      c.validation?.extraction_status,
      c.contact?.email || '',
      c.contact?.phone || '',
      `"${c.filename}"`,
    ]);

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
            Showing {filteredCandidates.length} of {candidates.length} ranked profiles
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
              placeholder="Search candidate or skill..."
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

      {/* Table */}
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
            {filteredCandidates.map((cand) => {
              const isFailedParse = cand.validation?.extraction_status === 'failed';
              const overallScore = cand.score?.overall_score || 0;
              const reqFit = cand.score?.required_skill_fit || 0;
              const prefFit = cand.score?.preferred_skill_fit || 0;
              const expYears = cand.profile?.experience_years;

              return (
                <tr key={cand.id}>
                  <td>{getRankBadge(cand.rank)}</td>

                  <td>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                        {cand.name}
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
                        <span>{cand.filename}</span>
                        {cand.contact?.email && (
                          <a
                            href={`mailto:${cand.contact.email}`}
                            title={cand.contact.email}
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Mail size={13} />
                          </a>
                        )}
                        {cand.contact?.phone && (
                          <a
                            href={`tel:${cand.contact.phone}`}
                            title={cand.contact.phone}
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <Phone size={13} />
                          </a>
                        )}
                        {cand.contact?.linkedin && (
                          <a
                            href={cand.contact.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            title="LinkedIn"
                            style={{ color: '#0077b5', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <LinkedInIcon size={13} />
                          </a>
                        )}
                        {cand.contact?.github && (
                          <a
                            href={cand.contact.github}
                            target="_blank"
                            rel="noreferrer"
                            title="GitHub"
                            style={{ color: '#24292e', display: 'inline-flex', alignItems: 'center' }}
                          >
                            <GitHubIcon size={13} />
                          </a>
                        )}
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className={`score-pill ${getScoreClass(overallScore)}`}>
                      {formatScore(overallScore)}%
                    </span>
                  </td>

                  <td>
                    <div style={{ fontWeight: 700, color: reqFit >= 60 ? 'var(--emerald-text)' : 'var(--text-main)' }}>
                      {formatScore(reqFit)}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                      {cand.score?.matched_required?.length || 0} matched
                    </div>
                  </td>

                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {formatScore(prefFit)}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                      {cand.score?.matched_preferred?.length || 0} matched
                    </div>
                  </td>

                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {expYears !== null && expYears !== undefined ? `${expYears} yrs` : 'Unknown'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                      {cand.score?.experience_fit !== null && cand.score?.experience_fit !== undefined
                        ? `${formatScore(cand.score.experience_fit)}% fit`
                        : 'N/A'}
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span className="chip chip-slate" style={{ fontSize: '0.72rem', alignSelf: 'flex-start' }}>
                        {cand.parse_method}
                      </span>
                      {isFailedParse && (
                        <span
                          className="chip chip-amber"
                          style={{ fontSize: '0.72rem', alignSelf: 'flex-start' }}
                          title={cand.validation?.warnings?.join(', ')}
                        >
                          <AlertTriangle size={12} />
                          <span>[!REVIEW]</span>
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => onSelectCandidate(cand)}
                        className="btn btn-secondary btn-sm"
                        title="View complete match evidence and terminal breakdown"
                      >
                        <Eye size={14} />
                        <span>Inspect Match</span>
                      </button>

                      <button
                        onClick={() => onOpenInsights(cand)}
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

            {filteredCandidates.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No candidates match your current filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
