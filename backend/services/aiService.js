

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';

class AiService {
    async callAnalyzeJd(jdText) {
        const response = await fetch(`${AI_SERVICE_URL}/analyze-jd`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_description: jdText })
        });
        const data = await response.json();
        if (!response.ok || data.error) {
            throw new Error(data.error || 'Failed to analyze JD via AI service');
        }
        return data;
    }

    async callParse(pdfPath) {
        const response = await fetch(`${AI_SERVICE_URL}/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pdf_path: pdfPath })
        });
        
        const data = await response.json();
        if (!response.ok || data.error) {
            throw new Error(data.error || 'Failed to parse resume via AI service');
        }
        return data;
    }

    async callScreen(jobProfile, candidateProfile, resumeLines) {
        const response = await fetch(`${AI_SERVICE_URL}/screen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_profile: jobProfile,
                candidate_profile: candidateProfile,
                resume_lines: resumeLines
            })
        });

        const data = await response.json();
        if (!response.ok || data.error) {
            throw new Error(data.error || 'Failed to score candidate via AI service');
        }
        return data;
    }

    async callInsights(candidateProfile, jobProfile, scoreResult) {
        const response = await fetch(`${AI_SERVICE_URL}/insights`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                candidate_profile: candidateProfile,
                job_profile: jobProfile,
                score_result: scoreResult
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.reason || data.error || 'Failed to generate AI insights');
        }
        return data; // { status: "ok", ... }
    }

    async callChat(candidateProfile, jobProfile, scoreResult, conversation, question) {
        const response = await fetch(`${AI_SERVICE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                candidate_profile: candidateProfile,
                job_profile: jobProfile,
                score_result: scoreResult,
                conversation: conversation,
                question: question
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.reason || data.error || 'Failed to generate chat response');
        }
        return data; // { status: "ok", answer: "...", ... }
    }
}

const aiService = new AiService();
export default aiService;
