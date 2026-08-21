import React from 'react';
import { Layers, LogOut } from 'lucide-react';

export default function Header({ user, onLogout, onNavigate, currentPath }) {
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
              onClick={onLogout}
              className="btn btn-secondary btn-sm"
              title="Logout"
            >
              <LogOut size={14} />
              <span>Logout</span>
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
