import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useHashRouter } from '../hooks/useHashRouter';
import Header from '../components/Header';
import { Briefcase, Users, FileText, Activity } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { navigate } = useHashRouter();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/jobs');
        const data = await res.json();
        if (data.success) {
          setJobs(data.jobs);
        }
      } catch (err) {
        console.error("Failed to load jobs", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const openJobs = jobs.filter(j => j.status === 'open').length;

  return (
    <div className="page-container">
      <Header user={user} onLogout={logout} onNavigate={navigate} currentPath="/dashboard" />

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">Welcome, {user?.name}</h1>
          <button onClick={() => navigate('/jobs/create')} className="btn btn-primary">
            Create New Job
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon indigo">
              <Briefcase size={24} />
            </div>
            <div className="stat-content">
              <p>Total Jobs</p>
              <h3>{jobs.length}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon emerald">
              <Activity size={24} />
            </div>
            <div className="stat-content">
              <p>Open Jobs</p>
              <h3>{openJobs}</h3>
            </div>
          </div>
        </div>

        <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Your Jobs</h2>
        {loading ? (
          <div className="empty-state">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={48} style={{ margin: '0 auto 1rem', color: 'var(--text-light)' }} />
            <p style={{ fontSize: '1.125rem', color: 'var(--text-main)', fontWeight: '500' }}>No jobs created yet.</p>
            <button onClick={() => navigate('/jobs/create')} className="btn btn-secondary" style={{ marginTop: '1rem' }}>Create your first job</button>
          </div>
        ) : (
          <div className="table-card">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Experience</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.job_id}>
                    <td>
                      <div style={{ fontWeight: '500', color: 'var(--text-main)' }}>{job.title}</div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{job.description?.slice(0, 60) || ''}...</div>
                    </td>
                    <td>
                      <span className={`chip ${job.status === 'open' ? 'chip-emerald' : 'chip-slate'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td>
                      {job.min_experience_years}+ years
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => navigate(`/jobs/workspace?id=${job.job_id}`)} className="btn btn-sm btn-secondary">Workspace</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
