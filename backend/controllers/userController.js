import { findRecruiterById } from "../models/recruiterModel.js";

export const getUserData = async (req, res) => {
    try {

        const userId = req.userId;

        const recruiter = await findRecruiterById(userId);

        if (!recruiter) {
            return res.json({
                success: false,
                message: "Recruiter not found"
            });
        }

        return res.json({
            success: true,
            userData: {
                name: recruiter.name,
                isAccountVerified: recruiter.is_acc_verified
            }
        });

    } catch (error) {

        console.error("Get recruiter data error:", error);

        return res.json({
            success: false,
            message: error.message
        });
    }
};