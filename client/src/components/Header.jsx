import React, { useState } from 'react';
import { Layers, LogOut } from 'lucide-react';

export default function Header({ user, onLogout, onNavigate, currentPath }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };
  return (
    <header className="app-header">
      <div className="brand cursor-pointer" onClick={() => onNavigate && onNavigate('/dashboard')}>
        <div className="brand-icon">
          <Layers size={24} />
        </div>
        <div>
          <div className="brand-title">
            RecruitIQ
          </div>
          <div className="brand-tagline">
            Requirement-Aware Intelligent Recruitment
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {user ? (
          <>
            <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>
              {user.name} {user.email}
            </span>
            <button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="btn btn-secondary btn-sm"
              title="Logout"
            >
              <LogOut size={14} />
              <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </>
        ) : (
          <>
            {onNavigate && currentPath !== '/login' && currentPath !== '/register' && currentPath !== '/' && (
              <button 
                onClick={() => onNavigate('/login')}
                className="btn btn-secondary btn-sm"
              >
                Login
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
