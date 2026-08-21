import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, Circle } from 'lucide-react';

export default function CandidateSelectionPanel({ onSelect, selectedResumes = [], onSubmit }) {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadResumes();
  }, []);

  const loadResumes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/resumes');
      const data = await res.json();
      if (data.success) {
        setResumes(data.resumes);
      } else {
        setError(data.message || 'Failed to load resumes');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (resumeId) => {
    if (selectedResumes.includes(resumeId)) {
      onSelect(selectedResumes.filter(id => id !== resumeId));
    } else {
      onSelect([...selectedResumes, resumeId]);
    }
  };

  if (loading) {
    return <div className="card" style={{ padding: '20px', color: 'var(--text-muted)' }}>Loading your candidate pool...</div>;
  }

  if (error) {
    return <div className="card" style={{ padding: '20px', color: 'var(--rose-text)' }}>{error}</div>;
  }

  return (
    <div className="card" style={{ marginTop: '20px' }}>
      <div className="card-header">
        <div className="card-title-group">
          <div style={{ color: 'var(--primary-600)' }}>
            <User size={20} />
          </div>
          <div>
            <div className="card-title">Add Existing Candidates</div>
            <div className="card-subtitle">Select candidates from your recruiter pool to submit to this job.</div>
          </div>
        </div>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {resumes.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            You have no resumes in your pool. Upload new resumes first.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {resumes.map(resume => {
              const isSelected = selectedResumes.includes(resume.resume_id);

              // Extract name if parsed
              const parsedData = typeof resume.parsed_resume_json === 'string'
                ? JSON.parse(resume.parsed_resume_json || '{}')
                : (resume.parsed_resume_json || {});
              const name = parsedData.personal?.name || parsedData.contact?.name || "Unknown Candidate";

              return (
                <li
                  key={resume.resume_id}
                  onClick={() => toggleSelect(resume.resume_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--primary-50)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ marginRight: '12px', color: isSelected ? 'var(--primary-600)' : 'var(--text-subtle)' }}>
                    {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                      {name !== "Unknown Candidate" ? name : resume.original_filename}
                    </div>
                    {name !== "Unknown Candidate" && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                        {resume.original_filename}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
                    {resume.parser_status === 'ok' ? 'Parsed ✓' : `Parser: ${resume.parser_status}`}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selectedResumes.length > 0 && (
        <div className="card-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-subtle)' }}>
            {selectedResumes.length} candidate(s) selected
          </div>
          <button onClick={onSubmit} className="btn btn-primary">
            Submit Selected to Job
          </button>
        </div>
      )}
    </div>
  );
}
