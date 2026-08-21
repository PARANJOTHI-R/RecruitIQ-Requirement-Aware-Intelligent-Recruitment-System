import React, { useState, useEffect } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { AlertCircle, Layers } from 'lucide-react';

export default function VerifyPage() {
  const { navigate } = useHashRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Extract email from hash query manually since we use hash router
    const match = window.location.hash.match(/email=([^&]*)/);
    if (match) {
      setEmail(decodeURIComponent(match[1]));
    }
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (data.success) {
        setMsg('Account verified! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(data.message || 'Verification failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMsg('');
    try {
      const res = await fetch('/api/auth/send-verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        setMsg('Verification code sent to your email.');
      } else {
        setError(data.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-header cursor-pointer" onClick={() => navigate('/')}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary-600)' }}>
          <Layers size={32} />
          <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-main)' }}>RecruitIQ</span>
        </div>
        <h2 className="auth-title">Verify your Email</h2>
        <p className="auth-subtitle">Enter the OTP sent to {email}</p>
      </div>

      <div className="auth-card">
        <form onSubmit={handleVerify}>
          {error && (
            <div className="auth-alert error">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {msg && (
            <div className="auth-alert success">
              {msg}
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email" required readOnly={!!email}
              value={email} onChange={e => setEmail(e.target.value)}
              className="form-input"
              style={{ backgroundColor: 'var(--bg-card-subtle)' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">6-digit OTP</label>
            <input
              type="text" required maxLength={6}
              value={otp} onChange={e => setOtp(e.target.value)}
              className="form-input"
              style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '1.125rem' }}
            />
          </div>

          <button
            type="submit" disabled={loading || !otp}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? 'Verifying...' : 'Verify Account'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Didn't receive the code? <span style={{ color: 'var(--primary-600)', cursor: 'pointer', fontWeight: '500' }} onClick={handleResend}>Resend OTP</span>
        </div>
      </div>
    </div>
  );
}
