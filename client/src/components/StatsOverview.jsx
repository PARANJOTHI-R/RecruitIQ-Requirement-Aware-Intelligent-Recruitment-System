import { Users, Award, TrendingUp, CheckSquare } from 'lucide-react';
import { formatScore } from '../utils';

export default function StatsOverview({ results, jobProfile }) {
  if (!results || !results.candidates || results.candidates.length === 0) return null;

  const candidates = results.candidates;
  const totalCount = candidates.length;
  const topCandidate = candidates[0];
  const avgScoreNum = candidates.reduce((sum, c) => {
    let score = c.score?.overall_score || 0;
    // Normalize to percentage for average calculation
    if (score <= 1.0) score = score * 100;
    return sum + score;
  }, 0) / totalCount;
  const avgScore = avgScoreNum.toFixed(1);

  const reqSkillsCount = jobProfile?.required_skills?.length || 0;
  const prefSkillsCount = jobProfile?.preferred_skills?.length || 0;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: 'var(--primary-50)', color: 'var(--primary-600)' }}>
          <Users size={24} />
        </div>
        <div>
          <div className="stat-val">{totalCount}</div>
          <div className="stat-lbl">Candidates Screened</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: '#fef08a', color: '#854d0e' }}>
          <Award size={24} />
        </div>
        <div>
          <div className="stat-val">{formatScore(topCandidate?.score?.overall_score)}%</div>
          <div className="stat-lbl">Top Match: <strong>{topCandidate?.name}</strong></div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: 'var(--emerald-bg)', color: 'var(--emerald-text)' }}>
          <TrendingUp size={24} />
        </div>
        <div>
          <div className="stat-val">{avgScore}%</div>
          <div className="stat-lbl">Average Match Score</div>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: 'var(--sky-bg)', color: 'var(--sky-text)' }}>
          <CheckSquare size={24} />
        </div>
        <div>
          <div className="stat-val">{reqSkillsCount} + {prefSkillsCount}</div>
          <div className="stat-lbl">{reqSkillsCount} Required, {prefSkillsCount} Preferred Skills</div>
        </div>
      </div>
    </div>
  );
}
