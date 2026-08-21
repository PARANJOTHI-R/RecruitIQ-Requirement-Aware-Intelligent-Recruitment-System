import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHashRouter } from '../hooks/useHashRouter';
import Header from '../components/Header';
import ResumeUploadPanel from '../components/ResumeUploadPanel';
import CandidateSelectionPanel from '../components/CandidateSelectionPanel';
import LeaderboardTable from '../components/LeaderboardTable';
import CandidateDrawer from '../components/CandidateDrawer';
import { Briefcase, AlertCircle, FileText, CheckCircle2, User } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function JobWorkspace() {
  const { user, logout } = useAuth();
  const { navigate } = useHashRouter();

  const [jobId, setJobId] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [skills, setSkills] = useState({ required: [], preferred: [] });
  const [submissions, setSubmissions] = useState([]);

  // State for adding candidates
  const [addMode, setAddMode] = useState('pool'); // 'pool' | 'upload'
  const [stagedFiles, setStagedFiles] = useState([]); // for ResumeUploadPanel
  const [selectedPoolResumes, setSelectedPoolResumes] = useState([]); // for CandidateSelectionPanel

  // Drawer state
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [drawerTab, setDrawerTab] = useState('breakdown');

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);

  useEffect(() => {
    const match = window.location.hash.match(/id=([^&]*)/);
    if (match) {
      setJobId(match[1]);
    } else {
      navigate('/dashboard');
    }
  }, [navigate]);

  const loadJobWorkspace = async () => {
    if (!jobId) return;
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/workspace`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to load job workspace");

      setJobData(data.job);
      setSkills(data.skills);
      setSubmissions(data.submissions || []);
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Handle uploading new files AND submitting them
  const handleUploadAndSubmit = async () => {
    if (stagedFiles.length === 0) {
      setErrorBanner("Please select at least one resume file to upload.");
      return;
    }

    setIsProcessing(true);
    setErrorBanner(null);

    let successCount = 0;
    try {
      for (const file of stagedFiles) {
        // 1. Upload physical resume
        const formData = new FormData();
        formData.append('resume', file);
        const uploadRes = await fetch('/api/resumes', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          console.error(uploadData.message);
          continue;
        }
        const resumeId = uploadData.resume.resume_id;

        // 2. Create submission
        const subRes = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeId, jobId })
        });
        const subData = await subRes.json();
        if (subData.success) {
          successCount++;
        }
      }
      setStagedFiles([]); // Clear staged files after success
      if (successCount > 0) loadJobWorkspace(); // Refresh workspace
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle submitting existing pool resumes
  const handleSubmitPoolResumes = async () => {
    if (selectedPoolResumes.length === 0) return;

    setIsProcessing(true);
    setErrorBanner(null);
    let successCount = 0;
    try {
      for (const resumeId of selectedPoolResumes) {
        const subRes = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resumeId, jobId })
        });
        const subData = await subRes.json();
        if (subData.success) {
          successCount++;
        }
      }
      setSelectedPoolResumes([]);
      if (successCount > 0) loadJobWorkspace();
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle explicitly screening unscreened submissions
  const handleScreenUnscreened = async () => {
    const unscreened = submissions.filter(s => s.screening.status !== 'screened');
    if (unscreened.length === 0) return;

    setIsProcessing(true);
    setErrorBanner(null);

    let successCount = 0;
    try {
      for (const sub of unscreened) {
        if (sub.parser.status !== 'ok' && sub.parser.status !== 'degraded') {
          continue; // Skip if not parsed successfully
        }

        const screenRes = await fetch(`/api/screening/${sub.submission_id}`, { method: 'POST' });
        const screenData = await screenRes.json();
        if (screenData.success) {
          successCount++;
        }
      }

      if (successCount > 0) {
        try { confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } }); } catch (e) { }
        loadJobWorkspace();
      }
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openCandidateDrawer = (candidate) => {
    setSelectedCandidate(candidate);
    setDrawerTab('breakdown');
  };

  const closeCandidateDrawer = () => {
    setSelectedCandidate(null);
  };

  if (loading) {
    return (
      <div className="page-container">
        <Header user={user} onLogout={logout} onNavigate={navigate} currentPath="/jobs/workspace" />
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading Job Workspace...
        </div>
      </div>
    );
  }

  const unscreenedCount = submissions.filter(s => s.screening.status !== 'screened').length;

  return (
    <div className="page-container" style={{ position: 'relative' }}>
      <Header user={user} onLogout={logout} onNavigate={navigate} currentPath="/jobs/workspace" />

      <main className="page-content">
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="stat-icon indigo" style={{ padding: '0.5rem' }}>
              <Briefcase size={24} />
            </div>
            <h1 className="page-title">{jobData?.title}</h1>
            <span className={`chip ${jobData?.status === 'open' ? 'chip-emerald' : 'chip-slate'}`}>
              {jobData?.status}
            </span>
          </div>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary btn-sm">Back to Dashboard</button>
        </div>

        {errorBanner && (
          <div className="auth-alert error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={20} />
            <p>{errorBanner}</p>
          </div>
        )}

        <div className="workspace-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
          <div>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-main)' }}>Job Requirements</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>{jobData?.description}</p>

              <div className="section-box" style={{ marginBottom: '1rem' }}>
                <div className="section-box-title">Min Experience</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{jobData?.min_exp}+ years</div>
              </div>

              <div className="section-box" style={{ marginBottom: '1rem' }}>
                <div className="section-box-title">Required Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {skills.required.map((s, i) => (
                    <span key={i} className="chip chip-purple">{s}</span>
                  ))}
                </div>
              </div>

              <div className="section-box">
                <div className="section-box-title">Preferred Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {skills.preferred.map((s, i) => (
                    <span key={i} className="chip chip-slate">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <button
                className={`btn ${addMode === 'pool' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAddMode('pool')}
              >
                <User size={16} style={{ marginRight: '6px' }} /> From Pool
              </button>
              <button
                className={`btn ${addMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAddMode('upload')}
              >
                <FileText size={16} style={{ marginRight: '6px' }} /> Upload New
              </button>
            </div>

            {addMode === 'pool' && (
              <CandidateSelectionPanel
                selectedResumes={selectedPoolResumes}
                onSelect={setSelectedPoolResumes}
                onSubmit={handleSubmitPoolResumes}
              />
            )}

            {addMode === 'upload' && (
              <ResumeUploadPanel
                resumeFiles={stagedFiles}
                setResumeFiles={setStagedFiles}
                onScreen={handleUploadAndSubmit}
                isScreening={isProcessing}
                buttonText="Upload & Submit to Job"
              />
            )}
          </div>
        </div>

        {submissions.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Candidates ({submissions.length})</h2>
              {unscreenedCount > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handleScreenUnscreened}
                  disabled={isProcessing}
                >
                  <CheckCircle2 size={16} style={{ marginRight: '6px' }} />
                  Screen Unscreened ({unscreenedCount})
                </button>
              )}
            </div>

            <LeaderboardTable
              submissions={submissions}
              jobTitle={jobData?.title}
              onSelectCandidate={(cand) => openCandidateDrawer(cand, 'breakdown')}
              onOpenInsights={(cand) => openCandidateDrawer(cand, 'insights')}
            />
          </div>
        )}
      </main>

      <CandidateDrawer
        key={selectedCandidate?.submission_id}
        candidate={selectedCandidate}
        onClose={closeCandidateDrawer}
        jobProfile={{ title: jobData?.title, required_skills: skills.required, preferred_skills: skills.preferred, minimum_experience_years: jobData?.min_exp }}
        initialTab={drawerTab}
      />
    </div>
  );
}
