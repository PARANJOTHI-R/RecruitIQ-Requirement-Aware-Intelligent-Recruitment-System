import { getWorkspaceAggregate } from '../models/jobWorkspaceModel.js';

export const getJobWorkspaceHandler = async (req, res) => {
    const { id } = req.params;
    let limit = parseInt(req.query.limit, 10);
    let offset = parseInt(req.query.offset, 10);

    if (isNaN(limit) || limit <= 0) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;

    try {
        const workspaceData = await getWorkspaceAggregate(id, limit, offset);

        if (!workspaceData) {
            return res.json({ success: false, message: 'Job not found' });
        }

        // Verify the recruiter owns the job
        if (workspaceData.job.recruiter_id !== req.userId) {
            return res.json({ success: false, message: 'Unauthorized' });
        }

        // Format the response payload to match exactly what frontend expects
        const response = {
            success: true,
            job: workspaceData.job,
            skills: {
                required: workspaceData.skills.filter(s => s.is_required).map(s => s.skill_name),
                preferred: workspaceData.skills.filter(s => !s.is_required).map(s => s.skill_name)
            },
            submissions: workspaceData.submissions.map(sub => {
                const parsedData = typeof sub.parsed_resume_json === 'string'
                    ? JSON.parse(sub.parsed_resume_json || '{}')
                    : (sub.parsed_resume_json || {});

                return {
                    submission_id: sub.submission_id,
                    resume_id: sub.resume_id,
                    original_filename: sub.original_filename,
                    submitted_at: sub.submitted_at,
                    candidate: {
                        name: parsedData.personal?.name || parsedData.contact?.name || "Unknown Candidate",
                        email: parsedData.personal?.email || parsedData.contact?.email || null,
                        phone: parsedData.personal?.phone || parsedData.contact?.phone || null,
                        linkedin: parsedData.personal?.linkedin || parsedData.contact?.linkedin || null,
                        github: parsedData.personal?.github || parsedData.contact?.github || null
                    },
                    parser: {
                        status: sub.parser_status,
                        method: sub.parser_method
                    },
                    screening: sub.analysis_id ? {
                        status: 'screened',
                        analysis: {
                            analysis_id: sub.analysis_id,
                            overall_score: sub.overall_score,
                            required_skill_score: sub.required_skill_score,
                            preferred_skill_score: sub.preferred_skill_score,
                            experience_score: sub.experience_score,
                            education_score: sub.education_score,
                            semantic_role_score: sub.semantic_role_score,
                            evidence_coverage_score: sub.evidence_coverage_score,
                            experience_years: sub.experience_years,
                            experience_status: sub.experience_status
                        },
                        skill_matches: sub.skill_matches
                    } : {
                        status: 'not_screened',
                        analysis: null,
                        skill_matches: []
                    }
                };
            }),
            pagination: workspaceData.pagination
        };

        return res.json(response);
    } catch (error) {
        console.error("Workspace aggregation error:", error);
        return res.json({ success: false, message: error.message });
    }
};
