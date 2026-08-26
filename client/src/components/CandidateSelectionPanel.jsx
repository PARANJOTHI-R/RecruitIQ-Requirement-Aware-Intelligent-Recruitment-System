import React, { useState, useEffect } from 'react';
import { User, CheckCircle2, Circle } from 'lucide-react';
import { SkeletonTable } from './Skeleton';

export default function CandidateSelectionPanel({ onSelect, selectedResumes = [], onSubmit, jobId, isProcessing }) {
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

  // Eligible means NOT submitted to the CURRENT job
  const eligibleResumes = resumes.filter(r => !r.submitted_job_ids?.includes(jobId));

  const toggleSelect = (resumeId) => {
    const resume = resumes.find(r => r.resume_id === resumeId);
    if (resume?.submitted_job_ids?.includes(jobId)) return; // prevent selecting already submitted

    if (selectedResumes.includes(resumeId)) {
      onSelect(selectedResumes.filter(id => id !== resumeId));
    } else {
      onSelect([...selectedResumes, resumeId]);
    }
  };

  const handleSelectAll = () => {
    onSelect(eligibleResumes.map(r => r.resume_id));
  };

  const handleClearSelection = () => {
    onSelect([]);
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '20px' }}>
        <SkeletonTable rows={4} columns={2} />
      </div>
    );
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
      <div style={{ display: 'flex', gap: '8px', padding: '0 20px 16px' }}>
        <button onClick={handleSelectAll} className="btn btn-secondary btn-sm" disabled={eligibleResumes.length === 0}>
          Select All Eligible ({eligibleResumes.length})
        </button>
        <button onClick={handleClearSelection} className="btn btn-secondary btn-sm" disabled={selectedResumes.length === 0}>
          Clear Selection
        </button>
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

              const submittedJobs = resume.submitted_job_ids || [];
              const isSubmitted = submittedJobs.includes(jobId);
              const otherJobsCount = submittedJobs.filter(id => id !== jobId).length;

              return (
                <li
                  key={resume.resume_id}
                  onClick={() => toggleSelect(resume.resume_id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: isSubmitted ? 'not-allowed' : 'pointer',
                    background: isSelected ? 'var(--primary-50)' : 'transparent',
                    opacity: isSubmitted ? 0.6 : 1,
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ marginRight: '12px', color: isSelected ? 'var(--primary-600)' : 'var(--text-subtle)' }}>
                    {isSelected ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {name !== "Unknown Candidate" ? name : resume.original_filename}
                      {isSubmitted ? (
                        <span className="chip chip-slate" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Already submitted</span>
                      ) : (
                        <span className="chip chip-emerald" style={{ fontSize: '0.7rem', padding: '2px 6px' }}>Available for this job</span>
                      )}
                    </div>
                    {name !== "Unknown Candidate" && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{resume.original_filename}</span>
                        {otherJobsCount > 0 && !isSubmitted && (
                          <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                            • Used for {otherJobsCount} other job{otherJobsCount > 1 ? 's' : ''}
                          </span>
                        )}
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
          <button onClick={onSubmit} className="btn btn-primary" disabled={isProcessing}>
            {isProcessing ? (
              <>
                <span className="spinner-border" />
                <span>Submitting...</span>
              </>
            ) : (
              'Submit Selected to Job'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
