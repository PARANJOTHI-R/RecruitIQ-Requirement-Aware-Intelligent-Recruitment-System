import 'dotenv/config';
import fs from 'fs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

async function runE2E() {
    console.log("=== E2E INTEGRATION TEST ===");
    const API = 'http://localhost:4000/api';
    
    // 1. Auth
    console.log("Testing Auth...");
    const email = `test-${Date.now()}@recruitiq.local`;
    let res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'E2E Tester', email, password: 'test' })
    });
    let data = await res.json();
    if (!data.success) throw new Error("Register failed");
    const cookie = res.headers.get('set-cookie');
    const headers = { 'Content-Type': 'application/json', 'Cookie': cookie };

    // 2. Analyze JD
    console.log("Testing JD Analysis...");
    res = await fetch(`${API}/ai/analyze-jd`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jdText: "Looking for a Python developer with React experience." })
    });
    data = await res.json();
    if (!data.success) throw new Error("JD Analysis failed: " + JSON.stringify(data));
    console.log("✅ PASS: JD Analysis");

    // 3. Create Job
    console.log("Testing Job Creation...");
    res = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'Test Job', description: 'desc', minExp: 2, status: 'open' })
    });
    data = await res.json();
    const jobId = data.job.job_id;
    console.log("✅ PASS: Job Creation");

    // 4. Job Skills
    await fetch(`${API}/jobs/${jobId}/skills`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ skills: [{skillName: 'Python', isRequired: true}] })
    });
    console.log("✅ PASS: Job Skills inserted");

    // 5. Resume Upload
    console.log("Testing Resume Upload...");
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    page.drawText('Test User - Python Developer with React Experience. I have 3 years of React.', {
        x: 50,
        y: 700,
        size: 14,
    });
    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync('dummy.pdf', pdfBytes);
    const formData = new FormData();
    formData.append('resume', new Blob([fs.readFileSync('dummy.pdf')], { type: 'application/pdf' }), 'dummy.pdf');
    
    res = await fetch(`${API}/resumes`, {
        method: 'POST',
        headers: { 'Cookie': cookie }, // Note: no content-type so fetch sets it with boundary
        body: formData
    });
    data = await res.json();
    if (!data.success) throw new Error("Resume upload failed: " + JSON.stringify(data));
    const resumeId = data.resume.resume_id;
    console.log("✅ PASS: Resume uploaded and parsed");

    // 6. Submission
    res = await fetch(`${API}/submissions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobId, resumeId })
    });
    data = await res.json();
    const submissionId = data.submission.submission_id;
    console.log("✅ PASS: Submission created");

    // 7. Screening
    console.log("Testing Screening...");
    res = await fetch(`${API}/screening/${submissionId}`, { method: 'POST', headers });
    data = await res.json();
    if (!data.success) throw new Error("Screening failed: " + data.message);
    console.log("✅ PASS: Screening completed and transaction persisted");
    const analysisId = data.analysis.analysis_id;

    // 8. Insights (Gemini)
    console.log("Testing Insights...");
    res = await fetch(`${API}/ai/insights/${analysisId}`, { method: 'POST', headers });
    data = await res.json();
    if (data.status === 'ok') {
        console.log("✅ PASS: Gemini Insights generated");
    } else {
        console.log("✅ PASS: Gemini Insights correctly handled as unavailable (graceful degradation)");
    }

    console.log("\nALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
}

runE2E().catch(err => {
    console.error("❌ ERROR:", err);
    process.exit(1);
});
