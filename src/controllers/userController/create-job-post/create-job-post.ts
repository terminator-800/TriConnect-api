import type { Request, Response } from "express";
import type { PoolConnection } from "mysql2/promise";
import { createJobPosts } from "../../userController/create-job-post/create-job-post-service.js";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";

// Request body type
interface CreateJobPostBody {
    job_title: string;
    job_type: "Full-time" | "Part-time" | "Contract";
    salary_range: string;
    location: string;
    required_skill: string;
    job_description: string;
}


// Authenticated user type
interface AuthenticatedUser {
    user_id: number;
    role: typeof ROLE[keyof typeof ROLE];
}


// Result types
interface SuccessResult {
    success: true;
    job_post_id: number;
    message: string;
}

interface ErrorResult {
    error: string;
    details?: string;
}

type CreateJobPostResult = SuccessResult | ErrorResult;


// Allowed roles
const allowedRoles: typeof ROLE[keyof typeof ROLE][] = [
    ROLE.BUSINESS_EMPLOYER,
    ROLE.INDIVIDUAL_EMPLOYER,
    ROLE.MANPOWER_PROVIDER,
];

// Controller
export const createJobPost = async (request: Request<unknown, unknown, CreateJobPostBody>, response: Response) => {

    const { user } = request as Request & { user: AuthenticatedUser };
    const ip = request.ip;
    let connection: PoolConnection | undefined;

    try {
        connection = await pool.getConnection();

        const { user_id, role } = user;

        if (!allowedRoles.includes(role)) {
            logger.warn("Unauthorized role tried to create job post", { user_id, role, ip });
            return response.status(403).json({ error: "Forbidden: Only authorized employers can create job posts." });
        }

        const { job_title, job_type, salary_range, location, required_skill, job_description } = request.body;
        
        const typedJobType = job_type as "Full-time" | "Part-time" | "Contract";

        const result: CreateJobPostResult = await createJobPosts(connection, {
            user_id,
            job_title,
            job_type: typedJobType,
            salary_range,
            location,
            required_skill,
            job_description,
        });

        if ('error' in result) {
            logger.warn("Validation or service error returned from createJobPosts", { result, user_id, ip });
            return response.status(400).json({ error: result.error });
        }

        return response.status(201).json({
            message: result.message,
            job_post_id: result.job_post_id,
        });

    } catch (error: any) {
        if (connection) connection.rollback();
        logger.error("Unexpected error in createJobPost controller", {
            error: error,
            name: error?.name || "UnknownError",
            message: error?.message || "No message",
            stack: error?.stack || "No stack trace",
            cause: error?.cause || "No cause",
            ip,
        });
        return response.status(500).json({ error: "Internal server error." });
    } finally {
        if (connection) connection.release();
    }
};
