import type { CustomRequest } from "../../../types/express/auth.js";
import type { Response } from "express";
import { format } from "date-fns";
import { ROLE } from "../../../utils/roles.js";
import pool from "../../../config/database-connection.js";
import logger from "../../../config/logger.js";

type Role = typeof ROLE[keyof typeof ROLE];

interface BaseJobPost {
    user_id: number;
    role: Role;
    email: string;
    job_post_id: number;
    job_title: string;
    job_type: string;
    salary_range: string;
    location: string;
    required_skill: string;
    job_description: string;
    approved_at: string | null;
    verified_at: string | null;
}

interface JobseekerJobPost extends BaseJobPost {
    full_name: string;
    date_of_birth: string | null;
    phone: string;
    gender: string;
    present_address: string;
    permanent_address: string;
    education: string;
    skills: string;
    government_id: string;
    selfie_with_id: string;
    nbi_barangay_clearance: string;
}

interface IndividualEmployerJobPost extends BaseJobPost {
    full_name: string;
    date_of_birth: string | null;
    phone: string;
    gender: string;
    present_address: string;
    permanent_address: string;
    government_id: string;
    selfie_with_id: string;
    nbi_barangay_clearance: string;
}

interface BusinessEmployerJobPost extends BaseJobPost {
    business_name: string;
    business_address: string;
    industry: string;
    business_size: string;
    authorized_person: string;
    authorized_person_id: string;
    business_permit_BIR: string;
    DTI: string;
    business_establishment: string;
}

interface ManpowerProviderJobPost extends BaseJobPost {
    agency_name: string;
    agency_address: string;
    agency_services: string;
    agency_authorized_person: string;
    authorized_person_id: string;
    dole_registration_number: string;
    mayors_permit: string;
    agency_certificate: string;
}

type VerifiedJobPost =
    | JobseekerJobPost
    | IndividualEmployerJobPost
    | BusinessEmployerJobPost
    | ManpowerProviderJobPost
    | BaseJobPost;

export const verifiedJobPosts = async (req: CustomRequest, res: Response) => {
    let connection;

    if (req.user?.role !== ROLE.ADMINISTRATOR) {
        return res.status(403).json({ message: "Forbidden: Administrator only" });
    }

    try {
        connection = await pool.getConnection();

        const [rows] = await connection.query<any[]>(`
            /* ===== Unified Verified Job Posts (All Types) ===== */

            /* Standard Job Post */
            SELECT
                'job_post' AS post_type,
                jp.job_post_id AS post_id,
                jp.user_id,
                u.role,
                u.email,
                jp.job_title,
                jp.job_type,
                jp.salary_range,
                jp.location,
                jp.required_skill AS skill,
                jp.job_description,
                jp.approved_at,
                jp.submitted_at,
                u.verified_at,

                NULL AS worker_name,
                NULL AS worker_category,
                NULL AS years_of_experience,
                NULL AS qualifications,
                NULL AS number_of_workers,
                NULL AS senior_workers,
                NULL AS mid_level_workers,
                NULL AS junior_workers,
                NULL AS entry_level_workers,
                NULL AS team_skills

            FROM job_post jp
            LEFT JOIN users u ON jp.user_id = u.user_id
            WHERE jp.is_verified_jobpost = 1
              AND jp.jobpost_status != 'deleted'

            UNION ALL

            /* Individual Job Post */
            SELECT
                'individual_job_post' AS post_type,
                ijp.individual_job_post_id AS post_id,
                ijp.user_id,
                u.role,
                u.email,
                ijp.worker_name AS job_title,
                ijp.worker_category AS job_type,
                NULL AS salary_range,
                ijp.location,
                ijp.skill,
                ijp.qualifications AS job_description,
                ijp.approved_at,
                ijp.submitted_at,
                u.verified_at,

                ijp.worker_name,
                ijp.worker_category,
                ijp.years_of_experience,
                ijp.qualifications,
                NULL AS number_of_workers,
                NULL AS senior_workers,
                NULL AS mid_level_workers,
                NULL AS junior_workers,
                NULL AS entry_level_workers,
                NULL AS team_skills

            FROM individual_job_post ijp
            LEFT JOIN users u ON ijp.user_id = u.user_id
            WHERE ijp.is_verified_jobpost = 1
              AND ijp.jobpost_status != 'deleted'

            UNION ALL

            /* Team Job Post */
            SELECT
                'team_job_post' AS post_type,
                tjp.team_job_post_id AS post_id,
                tjp.user_id,
                u.role,
                u.email,
                CONCAT(tjp.worker_category) AS job_title,
                tjp.worker_category AS job_type,
                NULL AS salary_range,
                tjp.location,
                tjp.team_skills AS skill,
                NULL AS job_description,
                tjp.approved_at,
                tjp.submitted_at,
                u.verified_at,

                NULL AS worker_name,
                tjp.worker_category,
                NULL AS years_of_experience,
                NULL AS qualifications,
                tjp.number_of_workers,
                tjp.senior_workers,
                tjp.mid_level_workers,
                tjp.junior_workers,
                tjp.entry_level_workers,
                tjp.team_skills

            FROM team_job_post tjp
            LEFT JOIN users u ON tjp.user_id = u.user_id
            WHERE tjp.is_verified_jobpost = 1
              AND tjp.jobpost_status != 'deleted'
            ORDER BY approved_at DESC, submitted_at DESC;
        `);

        const formattedRows = rows.map(job => ({
            ...job,
            approved_at: job.approved_at ? format(new Date(job.approved_at), "yyyy-MM-dd ") : null,
            submitted_at: job.submitted_at ? format(new Date(job.submitted_at), "yyyy-MM-dd") : null,
            verified_at: job.verified_at ? format(new Date(job.verified_at), "yyyy-MM-dd") : null,
        }));
        
        res.json(formattedRows);

    } catch (err) {
        logger.error(err);
        return res.status(500).json({ message: "Failed to fetch verified job posts." });
    } finally {
        if (connection) connection.release();
    }
};

