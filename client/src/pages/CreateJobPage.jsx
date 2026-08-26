import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHashRouter } from '../hooks/useHashRouter';
import Header from '../components/Header';
import JobDescriptionPanel from '../components/JobDescriptionPanel';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function CreateJobPage() {
  const { user, logout } = useAuth();
  const { navigate } = useHashRouter();
  
  const [jdText, setJdText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [structuredData, setStructuredData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Editable fields after analysis
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minExp, setMinExp] = useState(0);
  const [requiredSkills, setRequiredSkills] = useState([]);
  const [preferredSkills, setPreferredSkills] = useState([]);

  const handleAnalyze = async () => {
    if (!jdText.trim()) {
      setError("Please enter a job description.");
      return;
    }
    setError('');
    setAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to analyze JD");
      
      const profile = data.jobProfile;
      setStructuredData(profile);
      setTitle(profile.title || '');
      setDescription(jdText);
      setMinExp(profile.minimum_experience_years || 0);
      setRequiredSkills(profile.required_skills || []);
      setPreferredSkills(profile.preferred_skills || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveJob = async () => {
    setError('');
    setSaving(true);
    try {
      // 1. Create Job
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, minExp, status: 'open' })
      });
      const jobData = await jobRes.json();
      if (!jobData.success) throw new Error(jobData.message || "Failed to create job");
      const jobId = jobData.job.job_id;

      // 2. Add Skills
      const reqList = requiredSkills.map(s => ({ skillName: s, isRequired: true }));
      const prefList = preferredSkills.map(s => ({ skillName: s, isRequired: false }));
      const allSkills = [...reqList, ...prefList];
      
      if (allSkills.length > 0) {
        await fetch(`/api/jobs/${jobId}/skills`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skills: allSkills })
        });
      }

      // Navigate to Workspace
      navigate(`/jobs/workspace?id=${jobId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <Header user={user} onLogout={logout} onNavigate={navigate} currentPath="/jobs/create" />
      
      <main className="page-content" style={{ maxWidth: '800px' }}>
        <div className="page-header">
          <h1 className="page-title">Create New Job</h1>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary btn-sm">Back to Dashboard</button>
        </div>

        {error && (
          <div className="auth-alert error">
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {!structuredData ? (
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-main)' }}>Step 1: Analyze Job Description</h2>
            <textarea
              className="form-input"
              style={{ minHeight: '300px', resize: 'vertical' }}
              placeholder="Paste your job description here..."
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              disabled={analyzing}
            />
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleAnalyze} 
                disabled={analyzing || !jdText.trim()}
                className="btn btn-primary btn-lg"
              >
                {analyzing ? 'Analyzing JD...' : 'Analyze JD'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', color: 'var(--emerald-main)' }}>
              <CheckCircle style={{ marginRight: '0.5rem' }} /> Step 2: Review & Save Job
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Job Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Minimum Experience (Years)</label>
                <input
                  type="number"
                  value={minExp}
                  onChange={e => setMinExp(Number(e.target.value))}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Required Skills (comma separated)</label>
                <input
                  type="text"
                  value={requiredSkills.join(', ')}
                  onChange={e => setRequiredSkills(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Preferred Skills (comma separated)</label>
                <input
                  type="text"
                  value={preferredSkills.join(', ')}
                  onChange={e => setPreferredSkills(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  className="form-input"
                />
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                onClick={() => setStructuredData(null)} 
                disabled={saving}
                className="btn btn-secondary"
              >
                Start Over
              </button>
              <button 
                onClick={handleSaveJob} 
                disabled={saving || !title.trim()}
                className="btn btn-primary"
                style={{ backgroundColor: 'var(--emerald-main)', borderColor: 'var(--emerald-main)' }}
              >
                {saving ? 'Creating Job...' : 'Confirm & Save Job'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
