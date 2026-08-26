import React, { useState, useRef } from 'react';
import { UploadCloud, File, Trash2, FolderPlus, Play, CheckCircle2, FileText } from 'lucide-react';

export default function ResumeUploadPanel({
  resumeFiles,
  setResumeFiles,
  onScreen,
  isScreening,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilesAdded = (files) => {
    if (!files || files.length === 0) return;
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
      </div>

      {/* Drag & Drop Area */}
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

      {/* Action Button */}
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={onScreen}
          disabled={isScreening || resumeFiles.length === 0}
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          {isScreening ? (
            <>
              <span className="spinner-border" />
              <span>Uploading & Submitting...</span>
            </>
          ) : (
            <>
              <Play size={18} />
              <span>
                Screen {resumeFiles.length} Resumes
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
