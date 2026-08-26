import React, { useState } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { AlertCircle, Layers } from 'lucide-react';

export default function RegisterPage() {
  const { navigate } = useHashRouter();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (data.success) {
        // Backend handles OTP generation internally, redirect to verify
        navigate(`/verify?email=${encodeURIComponent(email)}`);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header cursor-pointer" onClick={() => navigate('/')}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary-600)' }}>
          <Layers size={32} />
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>RecruitIQ</span>
        </div>
        <h2 className="auth-title">Create an Account</h2>
        <p className="auth-subtitle">Join RecruitIQ to start screening candidates</p>
      </div>

      <div className="auth-card">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="auth-alert error">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text" required
              value={name} onChange={e => setName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="form-input"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Already have an account? <span style={{ color: 'var(--primary-600)', cursor: 'pointer', fontWeight: '500' }} onClick={() => navigate('/login')}>Sign in</span>
        </div>
      </div>
    </div>
  );
}
