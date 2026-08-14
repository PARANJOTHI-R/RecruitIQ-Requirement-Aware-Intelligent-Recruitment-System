import React, { useRef } from 'react';

function ResumeUpload({ files, setFiles }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    // Filter only PDFs
    const validFiles = selectedFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    
    if (validFiles.length !== selectedFiles.length) {
      alert("Some files were skipped because they are not PDFs.");
    }

    setFiles(prev => [...prev, ...validFiles]);
    
    // Reset input so the same files can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="form-group">
      <label className="form-label">Upload Resumes (PDF only)</label>
      
      <div 
        style={{
          border: '2px dashed var(--border-color)',
          borderRadius: 'var(--border-radius)',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          cursor: 'pointer',
          marginBottom: '1rem'
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
          Drag & drop PDF files here or Click to Browse
        </div>
        <input 
          type="file" 
          multiple 
          accept=".pdf,application/pdf"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button type="button" className="btn btn-secondary">
          Browse Files
        </button>
      </div>

      {files.length > 0 && (
        <div>
          <div className="text-sm text-muted mb-2">Selected files ({files.length}):</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {files.map((file, idx) => (
              <li 
                key={`${file.name}-${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  backgroundColor: 'white',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  marginBottom: '0.5rem'
                }}
              >
                <span className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
                <button 
                  type="button" 
                  onClick={() => removeFile(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--error-color)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ResumeUpload;
