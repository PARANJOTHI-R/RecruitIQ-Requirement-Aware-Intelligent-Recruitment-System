import React, { useState } from 'react';
import JobInput from './JobInput';
import ResumeUpload from './ResumeUpload';

function ScreeningForm({ onSubmit, isProcessing }) {
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!jobDescription.trim()) {
      setError("Please enter a job description.");
      return;
    }

    if (files.length === 0) {
      setError("Please select at least one PDF resume.");
      return;
    }

    const formData = new FormData();
    formData.append("job_description", jobDescription);
    files.forEach(file => {
      formData.append("resumes", file);
    });

    onSubmit(formData);
  };

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h2 style={{ fontSize: '1.125rem', margin: 0 }}>Start a New Screening</h2>
      </div>
      <div className="card-body">
        {error && (
          <div className="mb-4 text-sm" style={{ padding: '0.75rem', backgroundColor: 'var(--error-bg)', color: 'var(--error-color)', borderRadius: 'var(--border-radius)' }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <JobInput value={jobDescription} onChange={setJobDescription} />
          <ResumeUpload files={files} setFiles={setFiles} />
          
          <div className="flex justify-end mt-4">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing resumes...' : 'Screen Candidates'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScreeningForm;
