import React, { useState, useEffect } from 'react';
import { FileText, Upload, Sparkles, Code2, Briefcase, FileCode, CheckCircle, AlertCircle } from 'lucide-react';

export default function JobDescriptionPanel({
  jdText,
  setJdText,
  jdFile,
  setJdFile,
  activeJdTab,
  setActiveJdTab,
  analyzedJd,
  isAnalyzing,
  onAnalyze,
  sampleJds = [],
}) {
  const [selectedPresetId, setSelectedPresetId] = useState('backend-python');

  const handlePresetSelect = (e) => {
    const presetId = e.target.value;
    setSelectedPresetId(presetId);
    const found = sampleJds.find((j) => j.id === presetId);
    if (found) {
      setJdText(found.content);
      setJdFile(null);
    }
  };

  const handleFileUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (file) {
      setJdFile(file);
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <div style={{ color: 'var(--primary-600)' }}>
            <Briefcase size={20} />
          </div>
          <div>
            <div className="card-title">Job Description (JD)</div>
            <div className="card-subtitle">Input target role requirements & minimum qualifications</div>
          </div>
        </div>

        {sampleJds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>Presets:</span>
            <select
              value={selectedPresetId}
              onChange={handlePresetSelect}
              style={{
                fontSize: '0.8rem',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: '#ffffff',
                color: 'var(--text-main)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {sampleJds.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-list">
        <button
          className={`tab-btn ${activeJdTab === 'text' ? 'active' : ''}`}
          onClick={() => {
            setActiveJdTab('text');
            setJdFile(null);
          }}
        >
          <FileText size={15} />
          <span>Paste Text</span>
        </button>

        <button
          className={`tab-btn ${activeJdTab === 'pdf' ? 'active' : ''}`}
          onClick={() => setActiveJdTab('pdf')}
        >
          <Upload size={15} />
          <span>Upload PDF JD</span>
        </button>

        <button
          className={`tab-btn ${activeJdTab === 'doc' ? 'active' : ''}`}
          onClick={() => setActiveJdTab('doc')}
        >
          <FileCode size={15} />
          <span>Upload DOCX / DOC</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeJdTab === 'text' && (
        <div>
          <textarea
            className="text-area"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste Job Description here... e.g.&#10;Backend Software Engineer&#10;Required Skills: Python, FastAPI, PostgreSQL, Git&#10;Preferred Skills: Docker, AWS, Redis, Microservices&#10;Min Exp: 1 year"
            rows={8}
          />
        </div>
      )}

      {(activeJdTab === 'pdf' || activeJdTab === 'doc') && (
        <div>
          <label className="dropzone" style={{ minHeight: '180px' }}>
            <input
              type="file"
              accept={activeJdTab === 'pdf' ? '.pdf' : '.docx,.doc,.txt'}
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e, activeJdTab)}
            />
            <div className="dropzone-icon">
              <Upload size={24} />
            </div>
            <div>
              <div className="dropzone-title">
                {jdFile ? `Selected: ${jdFile.name}` : `Click or Drag & Drop ${activeJdTab.toUpperCase()} File`}
              </div>
              <div className="dropzone-desc">
                {jdFile
                  ? `${(jdFile.size / 1024).toFixed(1)} KB — Click to change file`
                  : `Upload official JD file in ${activeJdTab === 'pdf' ? '.PDF' : '.DOCX, .DOC, .TXT'} format`}
              </div>
            </div>
          </label>

          {jdFile && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="chip chip-emerald">
                <CheckCircle size={14} />
                <span>{jdFile.name} ready for extraction</span>
              </div>
              <button
                onClick={() => setJdFile(null)}
                className="btn btn-secondary btn-sm"
              >
                Clear file
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live Requirement Tags Preview */}
      {analyzedJd && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Parsed Requirements Profile
            </span>
            <span className="chip chip-slate" style={{ fontSize: '0.72rem' }}>
              Min Exp: <strong>{analyzedJd.minimum_experience_years || 0} years</strong>
            </span>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--emerald-text)', marginBottom: '4px' }}>
              Required Skills ({analyzedJd.required_skills?.length || 0}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {analyzedJd.required_skills?.map((skill, idx) => (
                <span key={idx} className="chip chip-emerald" style={{ fontSize: '0.75rem' }}>
                  {skill}
                </span>
              ))}
              {(!analyzedJd.required_skills || analyzedJd.required_skills.length === 0) && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>None specified</span>
              )}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sky-text)', marginBottom: '4px' }}>
              Preferred Skills ({analyzedJd.preferred_skills?.length || 0}):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {analyzedJd.preferred_skills?.map((skill, idx) => (
                <span key={idx} className="chip chip-sky" style={{ fontSize: '0.75rem' }}>
                  {skill}
                </span>
              ))}
              {(!analyzedJd.preferred_skills || analyzedJd.preferred_skills.length === 0) && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>None specified</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
