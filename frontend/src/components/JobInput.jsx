import React from 'react';

function JobInput({ value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor="job-description">
        Job Description
      </label>
      <textarea
        id="job-description"
        className="form-control"
        placeholder="Paste the job description here..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default JobInput;
