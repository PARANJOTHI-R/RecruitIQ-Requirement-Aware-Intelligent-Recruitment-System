import React from 'react';

// ============================================================================
// Atomic Primitives
// ============================================================================

export const SkeletonBox = React.memo(({ width, height, borderRadius, style, className = '' }) => (
  <div
    className={`skeleton ${className}`}
    style={{
      width: width || '100%',
      height: height || '20px',
      borderRadius: borderRadius || 'var(--radius-md)',
      ...style
    }}
  />
));

export const SkeletonText = React.memo(({ lines = 1, lineHeight = '16px', gap = '12px', width = '100%', lastLineWidth = '70%', style, className = '' }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, width, ...style }} className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          height={lineHeight}
          borderRadius="4px"
          width={i === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
});

// ============================================================================
// Composed Loaders
// ============================================================================

export const TopProgressBar = React.memo(() => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '3px',
    background: 'transparent',
    zIndex: 9999,
    overflow: 'hidden'
  }}>
    <div className="skeleton top-progress-bar-inner" style={{
      width: '100%',
      height: '100%',
      background: 'var(--primary-500)',
      animation: 'slideRight 2s cubic-bezier(0.16, 1, 0.3, 1) infinite'
    }} />
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes slideRight {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `}} />
  </div>
));

export const AppBootLoader = React.memo(() => (
  <div className="min-h-screen flex items-center justify-center" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: 'var(--bg-main)' }}>
    <div className="pulse-card" style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-lg)', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: 'var(--shadow-lg)' }}>
      {/* Abstract Brand Shape */}
      <div style={{ width: '32px', height: '32px', border: '3px solid white', borderRadius: '8px', transform: 'rotate(45deg)' }} />
    </div>
    <SkeletonBox width="140px" height="6px" borderRadius="10px" />
  </div>
));

export const SkeletonCard = React.memo(({ titleWidth = '40%', lines = 3, style, className = '' }) => (
  <div className={`card ${className}`} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <SkeletonBox width="44px" height="44px" borderRadius="var(--radius-md)" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <SkeletonBox width={titleWidth} height="18px" />
        <SkeletonBox width="25%" height="12px" />
      </div>
    </div>
    <SkeletonText lines={lines} />
  </div>
));

export const SkeletonTable = React.memo(({ rows = 4, columns = 4 }) => (
  <div className="table-container">
    <table className="custom-table">
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i}>
              <SkeletonBox width="60%" height="14px" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td key={colIndex}>
                <SkeletonBox width={colIndex === 0 ? '70%' : '40%'} height="16px" />
                {colIndex === 0 && <SkeletonBox width="40%" height="12px" style={{ marginTop: '8px' }} />}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
));

export const SkeletonInsights = React.memo(() => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    {/* Insights Summary Skeleton */}
    <div className="card" style={{ padding: '20px', marginBottom: '24px', background: 'linear-gradient(to right, #fdf4ff, #faf5ff)', border: '1px solid #f3e8ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <SkeletonBox width="20px" height="20px" borderRadius="50%" />
        <SkeletonBox width="140px" height="20px" />
      </div>
      <SkeletonText lines={4} />
    </div>

    {/* Chat Interface Skeleton */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: '#ffffff', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <SkeletonBox width="16px" height="16px" borderRadius="50%" />
        <SkeletonBox width="200px" height="16px" />
      </div>

      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* User bubble */}
        <div style={{ alignSelf: 'flex-end', width: '60%', padding: '10px 14px', borderRadius: '12px', background: 'var(--primary-600)', opacity: 0.8 }}>
          <SkeletonBox width="100%" height="14px" style={{ background: 'rgba(255,255,255,0.4)' }} />
        </div>
        {/* AI bubble */}
        <div style={{ alignSelf: 'flex-start', width: '70%', padding: '10px 14px', borderRadius: '12px', background: '#f1f5f9' }}>
          <SkeletonText lines={3} />
        </div>
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', background: '#ffffff', display: 'flex' }}>
        <SkeletonBox width="100%" height="40px" borderRadius="20px" />
        <SkeletonBox width="40px" height="40px" borderRadius="50%" style={{ marginLeft: '8px', flexShrink: 0 }} />
      </div>
    </div>
  </div>
));

export const StepLoader = React.memo(({ currentFileIndex = 1, totalFiles = 1, stage = 'uploading' }) => {
  const steps = [
    { id: 'uploading', label: 'Uploading PDF' },
    { id: 'parsing', label: 'Parsing Data' },
    { id: 'submitting', label: 'Submitting to Job' }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === stage) || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', padding: '16px' }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
        Processing candidate {currentFileIndex} of {totalFiles}...
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex;
          const isActive = idx === currentStepIndex;
          
          return (
            <div key={step.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isCompleted ? 'var(--emerald-bg)' : (isActive ? 'var(--primary-100)' : '#f1f5f9'),
                border: `1px solid ${isCompleted ? 'var(--emerald-border)' : (isActive ? 'var(--primary-500)' : 'var(--border-subtle)')}`,
                color: isCompleted ? 'var(--emerald-main)' : (isActive ? 'var(--primary-600)' : 'var(--text-muted)'),
                zIndex: 2,
                fontSize: '0.8rem', fontWeight: 700
              }}>
                {isCompleted ? '✓' : (idx + 1)}
              </div>
              <div style={{ fontSize: '0.75rem', marginTop: '6px', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-main)' : 'var(--text-muted)', textAlign: 'center' }}>
                {step.label}
              </div>
              
              {/* Connection Line */}
              {idx < steps.length - 1 && (
                <div style={{
                  position: 'absolute', top: '14px', left: '50%', width: '100%', height: '2px',
                  background: isCompleted ? 'var(--emerald-border)' : 'var(--border-subtle)',
                  zIndex: 1
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
