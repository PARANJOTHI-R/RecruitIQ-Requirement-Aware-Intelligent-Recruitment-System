import React, { useState, useRef } from 'react';
import { UploadCloud, File, Trash2, FolderPlus, Play, CheckCircle2, FileText } from 'lucide-react';

export default function ResumeUploadPanel({
  resumeFiles,
  setResumeFiles,
  onScreen,
  isScreening,
  useDemoResumes,
  setUseDemoResumes,
  demoResumesCount = 13,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilesAdded = (files) => {
    if (!files || files.length === 0) return;
    setUseDemoResumes(false);
    const newFiles = Array.from(files);
    
    // Deduplicate by name and size
    setResumeFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const filtered = newFiles.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
      return [...prev, ...filtered];
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeFile = (index) => {
    setResumeFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearAllFiles = () => {
    setResumeFiles([]);
    setUseDemoResumes(false);
  };

  const totalSizeMB = (
    resumeFiles.reduce((acc, f) => acc + (f.size || 0), 0) /
    (1024 * 1024)
  ).toFixed(2);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title-group">
          <div style={{ color: 'var(--primary-600)' }}>
            <UploadCloud size={20} />
          </div>
          <div>
            <div className="card-title">Candidate Resumes</div>
            <div className="card-subtitle">Batch upload multiple resumes (PDF, DOCX, TXT)</div>
          </div>
        </div>

        <button
          onClick={() => {
            setUseDemoResumes(true);
            setResumeFiles([]);
          }}
          className={`btn btn-sm ${useDemoResumes ? 'btn-primary' : 'btn-accent'}`}
          title="Use all 13 demo resumes from server"
        >
          <FolderPlus size={14} />
          <span>Demo Pool ({demoResumesCount})</span>
        </button>
      </div>

      {/* Drag & Drop Area */}
      {!useDemoResumes && (
        <div>
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => handleFilesAdded(e.target.files)}
            />
            <div className="dropzone-icon">
              <UploadCloud size={26} />
            </div>
            <div>
              <div className="dropzone-title">Click or Drag & Drop Multiple Resumes Here</div>
              <div className="dropzone-desc">
                Supports PDF, Word (.docx, .doc), and Text files. Select multiple candidates at once.
              </div>
            </div>
          </div>

          {/* Staged File List */}
          {resumeFiles.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Selected Files ({resumeFiles.length}) — {totalSizeMB} MB
                </span>
                <button
                  onClick={clearAllFiles}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--rose-text)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear All
                </button>
              </div>

              <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                {resumeFiles.map((file, idx) => (
                  <div key={idx} className="file-item">
                    <div className="file-info">
                      <File size={16} color="var(--primary-600)" />
                      <div>
                        <div className="file-name" title={file.name}>
                          {file.name}
                        </div>
                        <div className="file-size">{(file.size / 1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-light)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Remove file"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Demo pool banner */}
      {useDemoResumes && (
        <div
          style={{
            background: 'var(--primary-50)',
            border: '1px solid var(--primary-200)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--primary-600)', marginBottom: '8px' }}>
            <CheckCircle2 size={32} style={{ margin: '0 auto' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
            Using All {demoResumesCount} Benchmark Resumes
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '420px', margin: '4px auto 14px' }}>
            Includes Akshay Chandar, Alex Chen, Sarah Jenkins, Elena Rostova, Marcus Vance, and more.
          </div>
          <button
            onClick={() => setUseDemoResumes(false)}
            className="btn btn-secondary btn-sm"
          >
            Switch to Custom File Upload
          </button>
        </div>
      )}

      {/* Action Button */}
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={onScreen}
          disabled={isScreening || (!useDemoResumes && resumeFiles.length === 0)}
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          {isScreening ? (
            <>
              <span className="spinner-border" />
              <span>Screening & Matching Candidates...</span>
            </>
          ) : (
            <>
              <Play size={18} />
              <span>
                Screen {useDemoResumes ? `${demoResumesCount} Demo Candidates` : `${resumeFiles.length} Resumes`}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
