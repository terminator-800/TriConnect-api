import type { Request, Response } from "express";
import type { PoolConnection } from "mysql2/promise";
import { format } from "date-fns";
import { ROLE } from "../../../utils/roles.js";
import pool from "../../../config/database-connection.js";
import logger from "../../../config/logger.js";

type Role =
    | "jobseeker"
    | "individual-employer"
    | "business-employer"
    | "manpower-provider"
    | "administrator";

interface JobPostBase {
    job_post_id: number;
    user_id: number;
    job_title?: string;
    job_description?: string;
    location: string;
    salary_range?: string | number;
    required_skill?: string;
    job_type?: string;
    role: Role;
    created_at: string | null;
}

/* For business employer job_post */
interface BusinessEmployerJobPost extends JobPostBase {
    employer_name: string;
    submitted_by: string;
    business_name: string;
    business_address: string;
    industry: string;
    business_size: string;
    authorized_person: string;
}

/* For individual employer job_post */
interface IndividualEmployerJobPost extends JobPostBase {
    employer_name: string;
    submitted_by: string;
    full_name: string;
    gender: string;
    present_address: string;
}

/* For manpower provider job_post */
interface ManpowerProviderJobPost extends JobPostBase {
    employer_name: string;
    submitted_by: string;
    agency_name: string;
    agency_address: string;
    agency_services: string;
    agency_authorized_person: string;
}

/* For individual_job_post */
interface IndividualWorkerJobPost {
    job_post_id: number;
    post_type: "individual_job_post";
    user_id: number;
    role: Role;
    created_at: string | null;

    // EMPLOYER INFO
    employer_name: string;
    submitted_by: string;
    agency_name: string;
    agency_address: string;
    agency_services: string;
    agency_authorized_person: string;

    // WORKER INFO
    worker_name: string;
    worker_category: string;
    years_of_experience: number;
    location: string;
    qualifications: string;
    skill: string;
}


/* For team_job_post */
interface TeamWorkerJobPost {
    job_post_id: number;
    post_type: "team_job_post";
    user_id: number;
    role: Role;
    created_at: string | null;

    // EMPLOYER INFO
    employer_name: string;
    submitted_by: string;
    agency_name: string;
    agency_address: string;
    agency_services: string;
    agency_authorized_person: string;

    // TEAM INFO
    worker_category: string;
    number_of_workers: number;
    location: string;
    senior_workers: number;
    mid_level_workers: number;
    junior_workers: number;
    entry_level_workers: number;
    team_skills: string;
}


type PendingJobPost =
    | BusinessEmployerJobPost
    | IndividualEmployerJobPost
    | ManpowerProviderJobPost
    | IndividualWorkerJobPost
    | TeamWorkerJobPost
    | JobPostBase;

export const pendingJobPosts = async (req: Request, res: Response) => {
    let connection: PoolConnection | undefined;

    if (req.user?.role !== ROLE.ADMINISTRATOR) {
        logger.warn(`Unauthorized attempt by user ID ${req.user?.user_id} to access pending job posts.`);
        res.status(403).json({ error: "Forbidden: Admins only." });
        return;
    }

    try {
        connection = await pool.getConnection();

        const jobposts = await getPendingJobPosts(connection);              // hiring
        const individualPosts = await getPendingIndividualJobPosts(connection); // individual
        const teamPosts = await getPendingTeamJobPosts(connection);         // team

        const mergedResponse = {
            hiring: jobposts,          // job_post table
            individual: individualPosts,
            team: teamPosts,
            total: jobposts.length + individualPosts.length + teamPosts.length
        };
        
        res.status(200).json(mergedResponse);


    } catch (error: any) {
        logger.error(`Unexpected error in pendingJobPosts endpoint`, error);
        res.status(500).json({ message: "Failed to fetch job posts" });
    } finally {
        if (connection) connection.release();
    }
};


async function getPendingJobPosts(connection: PoolConnection): Promise<PendingJobPost[]> {
    const query = `
        SELECT 
            jp.job_post_id,
            jp.user_id,
            jp.job_title,
            jp.job_description,
            jp.location,
            jp.salary_range,
            jp.required_skill,
            jp.created_at,
            jp.job_type,
            u.role,
            be.business_name,
            be.business_address,
            be.industry,
            be.business_size,
            be.authorized_person AS be_authorized_person,
            ie.full_name AS individual_full_name,
            ie.gender AS individual_gender,
            ie.present_address AS individual_present_address,
            mp.agency_name,
            mp.agency_address,
            mp.agency_services,
            mp.agency_authorized_person
        FROM job_post jp
        JOIN users u ON jp.user_id = u.user_id
        LEFT JOIN business_employer be 
            ON u.user_id = be.business_employer_id AND u.role = 'business-employer'
        LEFT JOIN individual_employer ie 
            ON u.user_id = ie.individual_employer_id AND u.role = 'individual-employer'
        LEFT JOIN manpower_provider mp 
            ON u.user_id = mp.manpower_provider_id AND u.role = 'manpower-provider'
        WHERE jp.jobpost_status = 'pending'
          AND jp.status = 'pending'
        ORDER BY jp.created_at DESC;
    `;

    const [rows]: any[] = await connection.query(query);

    return rows.map((post: any) => {
        const base: JobPostBase = {
            job_post_id: post.job_post_id,
            user_id: post.user_id,
            job_title: post.job_title,
            job_description: post.job_description,
            location: post.location,
            salary_range: post.salary_range,
            required_skill: post.required_skill,
            job_type: post.job_type,
            role: post.role,
            created_at: post.created_at
                ? format(new Date(post.created_at), "MMMM d, yyyy 'at' hh:mm a")
                : null,
        };

        switch (post.role) {
            case ROLE.BUSINESS_EMPLOYER:
                return {
                    ...base,
                    employer_name: post.business_name,
                    submitted_by: post.be_authorized_person,
                    business_name: post.business_name,
                    business_address: post.business_address,
                    industry: post.industry,
                    business_size: post.business_size,
                    authorized_person: post.be_authorized_person,
                };

            case ROLE.INDIVIDUAL_EMPLOYER:
                return {
                    ...base,
                    employer_name: post.individual_full_name,
                    submitted_by: post.individual_full_name,
                    full_name: post.individual_full_name,
                    gender: post.individual_gender,
                    present_address: post.individual_present_address,
                };

            case ROLE.MANPOWER_PROVIDER:
                return {
                    ...base,
                    employer_name: post.agency_name,
                    submitted_by: post.agency_authorized_person,
                    agency_name: post.agency_name,
                    agency_address: post.agency_address,
                    agency_services: post.agency_services,
                    agency_authorized_person: post.agency_authorized_person,
                };

            default:
                return base;
        }
    });
}

/* ---------------------------- INDIVIDUAL JOB POST ---------------------------- */

/* ---------------------------- INDIVIDUAL JOB POST ---------------------------- */

async function getPendingIndividualJobPosts(connection: PoolConnection): Promise<PendingJobPost[]> {
    const query = `
        SELECT 
            ijp.*,
            u.role,
            mp.agency_name,
            mp.agency_address,
            mp.agency_services,
            mp.agency_authorized_person,
            mp.agency_name AS employer_name,
            mp.agency_authorized_person AS submitted_by
        FROM individual_job_post ijp
        JOIN users u ON ijp.user_id = u.user_id
        LEFT JOIN manpower_provider mp 
            ON u.user_id = mp.manpower_provider_id 
        WHERE ijp.status = 'pending'
          AND ijp.jobpost_status = 'pending'
        ORDER BY ijp.created_at DESC;
    `;

    const [rows]: any[] = await connection.query(query);

    return rows.map((post: any) => ({
        job_post_id: post.individual_job_post_id,
        post_type: "individual_job_post",
        user_id: post.user_id,
        role: post.role, // always manpower-provider

        created_at: post.created_at
            ? format(new Date(post.created_at), "MMMM d, yyyy 'at' hh:mm a")
            : null,

        // employer info (ADDED)
        employer_name: post.employer_name,
        submitted_by: post.submitted_by,
        agency_name: post.agency_name,
        agency_address: post.agency_address,
        agency_services: post.agency_services,
        agency_authorized_person: post.agency_authorized_person,

        // job data
        worker_name: post.worker_name,
        worker_category: post.worker_category,
        years_of_experience: post.years_of_experience,
        location: post.location,
        qualifications: post.qualifications,
        skill: post.skill,
    }));
}


/* ---------------------------- TEAM JOB POST ---------------------------- */

async function getPendingTeamJobPosts(connection: PoolConnection): Promise<PendingJobPost[]> {
    const query = `
        SELECT 
            tjp.*,
            u.role,
            mp.agency_name,
            mp.agency_address,
            mp.agency_services,
            mp.agency_authorized_person,
            mp.agency_name AS employer_name,
            mp.agency_authorized_person AS submitted_by
        FROM team_job_post tjp
        JOIN users u ON tjp.user_id = u.user_id
        LEFT JOIN manpower_provider mp 
            ON u.user_id = mp.manpower_provider_id
        WHERE tjp.status = 'pending'
          AND tjp.jobpost_status = 'pending'
        ORDER BY tjp.created_at DESC;
    `;

    const [rows]: any[] = await connection.query(query);

    return rows.map((post: any) => ({
        job_post_id: post.team_job_post_id,
        post_type: "team_job_post",
        user_id: post.user_id,
        role: post.role, // always manpower-provider

        created_at: post.created_at
            ? format(new Date(post.created_at), "MMMM d, yyyy 'at' hh:mm a")
            : null,

        // employer info (ADDED)
        employer_name: post.employer_name,
        submitted_by: post.submitted_by,
        agency_name: post.agency_name,
        agency_address: post.agency_address,
        agency_services: post.agency_services,
        agency_authorized_person: post.agency_authorized_person,

        // job data
        worker_category: post.worker_category,
        number_of_workers: post.number_of_workers,
        location: post.location,
        senior_workers: post.senior_workers,
        mid_level_workers: post.mid_level_workers,
        junior_workers: post.junior_workers,
        entry_level_workers: post.entry_level_workers,
        team_skills: post.team_skills,
    }));
}

