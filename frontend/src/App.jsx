import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';

import Header from './components/Header';
import JobDescriptionPanel from './components/JobDescriptionPanel';
import ResumeUploadPanel from './components/ResumeUploadPanel';
import StatsOverview from './components/StatsOverview';
import LeaderboardTable from './components/LeaderboardTable';
import CandidateDrawer from './components/CandidateDrawer';

export default function App() {
  // Job Description State
  const [jdText, setJdText] = useState('');
  const [jdFile, setJdFile] = useState(null);
  const [activeJdTab, setActiveJdTab] = useState('text');
  const [analyzedJd, setAnalyzedJd] = useState(null);
  const [sampleJds, setSampleJds] = useState([]);

  // Resume State
  const [resumeFiles, setResumeFiles] = useState([]);
  const [useDemoResumes, setUseDemoResumes] = useState(true);
  const [demoResumesCount, setDemoResumesCount] = useState(13);

  // Screening & Results State
  const [isScreening, setIsScreening] = useState(false);
  const [results, setResults] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);

  // Candidate Inspector Drawer
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [drawerTab, setDrawerTab] = useState('breakdown');

  // Load sample JDs & check available demo resumes on mount
  useEffect(() => {
    fetch('/api/sample-jds')
      .then((res) => res.json())
      .then((data) => {
        if (data.samples && data.samples.length > 0) {
          setSampleJds(data.samples);
          setJdText(data.samples[0].content);
        }
      })
      .catch((err) => console.log('Could not load sample JDs:', err));

    fetch('/api/sample-files')
      .then((res) => res.json())
      .then((data) => {
        if (data.files) {
          setDemoResumesCount(data.files.length);
        }
      })
      .catch((err) => console.log('Could not load demo files:', err));
  }, []);

  // Analyze JD on the fly whenever text or file changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (jdText && !jdFile) {
        const formData = new FormData();
        formData.append('jd_text', jdText);
        fetch('/api/analyze-jd', {
          method: 'POST',
          body: formData,
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.required_skills) {
              setAnalyzedJd(data);
            }
          })
          .catch(() => {});
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [jdText, jdFile]);

  // Screening execution handler
  const handleStartScreening = async () => {
    setIsScreening(true);
    setErrorBanner(null);

    try {
      let endpoint = '/api/screen';
      const formData = new FormData();

      if (jdFile) {
        formData.append('jd_file', jdFile);
      } else if (jdText) {
        formData.append('jd_text', jdText);
      }

      if (useDemoResumes) {
        endpoint = '/api/screen-samples';
      } else {
        if (resumeFiles.length === 0) {
          throw new Error('Please select at least one resume file or use the demo pool.');
        }
        for (const file of resumeFiles) {
          formData.append('resumes', file);
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to complete screening.');
      }

      setResults(data);
      if (data.job_profile) {
        setAnalyzedJd(data.job_profile);
      }

      // Celebrate top score with confetti if >= 80%
      if (data.candidates && data.candidates.length > 0 && data.candidates[0].score?.overall_score >= 80) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4f46e5', '#10b981', '#f59e0b', '#06b6d4'],
          });
        } catch (e) {}
      }
    } catch (err) {
      setErrorBanner(err.message);
    } finally {
      setIsScreening(false);
    }
  };

  const handleReset = () => {
    setResults(null);
    setSelectedCandidate(null);
    setErrorBanner(null);
  };

  const handleQuickDemo = () => {
    setUseDemoResumes(true);
    if (sampleJds.length > 0) {
      setJdText(sampleJds[0].content);
      setJdFile(null);
      setActiveJdTab('text');
    }
    setTimeout(() => {
      handleStartScreening();
    }, 100);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <Header
        onQuickDemo={handleQuickDemo}
        onReset={handleReset}
        isScreening={isScreening}
        resultsCount={results?.candidates?.length || 0}
      />

      {/* Error Banner */}
      {errorBanner && (
        <div
          style={{
            background: 'var(--rose-bg)',
            border: '1px solid var(--rose-border)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 18px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--rose-text)',
          }}
        >
          <AlertCircle size={20} />
          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{errorBanner}</div>
        </div>
      )}

      {/* Top Input Configuration Grid */}
      <div className="main-grid">
        <JobDescriptionPanel
          jdText={jdText}
          setJdText={setJdText}
          jdFile={jdFile}
          setJdFile={setJdFile}
          activeJdTab={activeJdTab}
          setActiveJdTab={setActiveJdTab}
          analyzedJd={analyzedJd}
          sampleJds={sampleJds}
        />

        <ResumeUploadPanel
          resumeFiles={resumeFiles}
          setResumeFiles={setResumeFiles}
          onScreen={handleStartScreening}
          isScreening={isScreening}
          useDemoResumes={useDemoResumes}
          setUseDemoResumes={setUseDemoResumes}
          demoResumesCount={demoResumesCount}
        />
      </div>

      {/* Results Dashboard */}
      {results && (
        <div>
          <StatsOverview
            results={results}
            jobProfile={results.job_profile || analyzedJd}
          />

          <LeaderboardTable
            candidates={results.candidates}
            jobTitle={results.job_profile?.title || 'Target Role'}
            onSelectCandidate={(cand) => {
              setSelectedCandidate(cand);
              setDrawerTab('breakdown');
            }}
            onOpenInsights={(cand) => {
              setSelectedCandidate(cand);
              setDrawerTab('insights');
            }}
          />
        </div>
      )}

      {/* Deep Dive Candidate Inspector Drawer */}
      {selectedCandidate && (
        <CandidateDrawer
          candidate={selectedCandidate}
          jobProfile={results?.job_profile || analyzedJd}
          initialTab={drawerTab}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  );
}
