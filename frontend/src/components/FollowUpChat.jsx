import React, { useState } from 'react';
import { askCandidateQuestion } from '../services/api';

function FollowUpChat({ candidateId, initialChatHistory = [] }) {
  const [chatHistory, setChatHistory] = useState(initialChatHistory);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    const currentQuestion = question.trim();
    setQuestion("");
    setError(null);
    setIsLoading(true);

    // Optimistically add user question
    const newChatHistory = [...chatHistory, { role: "recruiter", content: currentQuestion }];
    setChatHistory(newChatHistory);

    try {
      const result = await askCandidateQuestion(candidateId, currentQuestion);
      if (result.status === "ok") {
        setChatHistory(prev => [...prev, { role: "model", content: result.answer }]);
      } else {
        throw new Error(result.answer || result.message || "Unable to retrieve an answer at this time.");
      }
    } catch (err) {
      setError(err.message);
      // Remove optimistic update if it failed, or show error message inline
      setChatHistory(prev => [...prev, { role: "system", content: "Error: " + err.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
      <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Ask about this candidate</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        {chatHistory.map((msg, idx) => (
          <div key={idx} style={{ 
            alignSelf: msg.role === 'recruiter' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            backgroundColor: msg.role === 'recruiter' ? 'var(--primary-color)' : (msg.role === 'system' ? 'var(--error-bg)' : '#f1f5f9'),
            color: msg.role === 'recruiter' ? 'white' : (msg.role === 'system' ? 'var(--error-color)' : 'var(--text-primary)'),
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius)',
            borderBottomRightRadius: msg.role === 'recruiter' ? 0 : 'var(--border-radius)',
            borderBottomLeftRadius: msg.role === 'recruiter' ? 'var(--border-radius)' : 0
          }}>
            <div className="text-sm font-medium mb-1" style={{ opacity: 0.8 }}>
              {msg.role === 'recruiter' ? 'You' : (msg.role === 'system' ? 'System' : 'AI Assistant')}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
          </div>
        ))}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', padding: '0.75rem', backgroundColor: '#f1f5f9', borderRadius: 'var(--border-radius)', color: 'var(--text-muted)' }}>
            Thinking...
          </div>
        )}
      </div>

      <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Ask a question about this candidate..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" className="btn btn-primary" disabled={isLoading || !question.trim()}>
          Ask AI
        </button>
      </form>
    </div>
  );
}

export default FollowUpChat;
