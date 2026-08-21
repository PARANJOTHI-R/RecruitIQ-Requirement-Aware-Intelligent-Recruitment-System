import fs from 'fs';
import {
    createResume,
    getResumesByRecruiter,
    getResumeById,
    updateResumeParseResult,
    deleteResume
} from '../models/resumeModel.js';

// aiService is injected at runtime — only available after Phase 7.
// The controller calls it only if it has been initialized.
let _aiService = null;
export const setAiService = (svc) => { _aiService = svc; };

export const uploadResumeHandler = async (req, res) => {
    if (!req.file) {
        return res.json({ success: false, message: 'No PDF file uploaded' });
    }

    const { originalname, path: storedPath } = req.file;

    try {
        // Create the resume record with parser_status = 'pending'
        const resume = await createResume({
            recruiterId: req.userId,
            originalFilename: originalname,
            storedPath
        });

        // Attempt parse if AI service is available
        if (_aiService) {
            try {
                const parseResult = await _aiService.callParse(storedPath);

                // Map parse result to DB fields
                // parseResult.validation.extraction_status: 'ok' | 'degraded' | 'failed'
                const parserStatus = parseResult.validation?.extraction_status || 'ok';
                const parserMethod = parseResult.parse_method || 'unknown';

                const updated = await updateResumeParseResult(resume.resume_id, {
                    parsedResumeJson: JSON.stringify(parseResult),
                    parserStatus,
                    parserMethod
                });

                return res.json({ success: true, resume: updated });
            } catch (parseError) {
                // Parse failure: record exists but is still 'pending'
                // Not a fatal error — resume is stored, can retry later
                console.error('Parse error for resume', resume.resume_id, parseError.message);
                return res.json({
                    success: true,
                    resume,
                    warning: 'Resume stored but could not be parsed. Ensure the AI service is running.'
                });
            }
        }

        // AI service not yet wired — return pending resume
        return res.json({ success: true, resume });

    } catch (error) {
        // Clean up uploaded file on DB error
        try { fs.unlinkSync(storedPath); } catch (_) { }
        return res.json({ success: false, message: error.message });
    }
};

export const getResumesHandler = async (req, res) => {
    try {
        const resumes = await getResumesByRecruiter(req.userId);
        return res.json({ success: true, resumes });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const getResumeHandler = async (req, res) => {
    const { id } = req.params;
    try {
        const resume = await getResumeById(id);
        if (!resume) {
            return res.json({ success: false, message: 'Resume not found' });
        }
        if (resume.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }
        return res.json({ success: true, resume });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export const deleteResumeHandler = async (req, res) => {
    const { id } = req.params;
    try {
        const resume = await getResumeById(id);
        if (!resume) {
            return res.json({ success: false, message: 'Resume not found' });
        }
        if (resume.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        await deleteResume(id);

        // Remove the file from disk
        try { fs.unlinkSync(resume.stored_path); } catch (_) { }

        return res.json({ success: true, message: 'Resume deleted' });
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};
