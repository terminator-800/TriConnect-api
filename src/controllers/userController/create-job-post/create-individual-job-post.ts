// controllers/individualJobPostController.ts
import type { Request, Response } from "express";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";
import { countActiveJobPostsAllTables} from './create-job-post-helper.js';

// Request body type
interface CreateIndividualJobPostBody {
    worker_name?: string;
    worker_category?: string;
    years_of_experience?: number | null;
    location?: string;
    qualifications?: string;
    skill?: string;
}

// Authenticated user type
interface AuthenticatedUser {
    user_id: number;
    role: typeof ROLE[keyof typeof ROLE];
}

// Result types
interface SuccessResult {
    success: true;
    individual_job_post_id: number;
    message: string;
}

interface ErrorResult {
    error: string;
    details?: string;
}

type CreateIndividualPostResult = SuccessResult | ErrorResult;

// Allowed roles
const allowedRoles: typeof ROLE[keyof typeof ROLE][] = [ROLE.MANPOWER_PROVIDER];

// Helper to convert undefined → null
function safe<T>(value: T | undefined): T | null {
    return value === undefined ? null : value;
}

// Controller
export const createIndividualJobPost = async (
    request: Request<unknown, unknown, CreateIndividualJobPostBody>,
    response: Response
) => {
    const { user } = request as Request & { user: AuthenticatedUser };
    const ip = request.ip;
    let connection: PoolConnection | undefined;

    try {
        connection = await pool.getConnection();
        const { user_id, role } = user;

        if (!allowedRoles.includes(role)) {
            logger.warn("Unauthorized role tried to create individual job post", { user_id, role, ip });
            return response.status(403).json({ error: "Forbidden: Only manpower providers can create job posts." });
        }

        // Prepare input for service
        const input: IndividualJobPostInput = {
            user_id,
            role,
            worker_name: safe(request.body.worker_name),
            worker_category: safe(request.body.worker_category),
            years_of_experience: safe(request.body.years_of_experience),
            location: safe(request.body.location),
            qualifications: safe(request.body.qualifications),
            skill: safe(request.body.skill),
        };

        // Validate input
        const validation = validateIndividualJobPostInput(input);
        if (validation.error) {
            logger.warn("Validation failed for individual job post", { user_id, ip, input });
            return response.status(400).json({ error: validation.error });
        }

        // Optional: check active posts limit
        const activePosts = await countActiveJobPostsAllTables(connection, user_id);

        if (activePosts >= 3) {
            logger.info("User reached max active job posts", { user_id, activePosts });
            return response.status(400).json({
                error: "You’ve reached the limit of 3 active job posts. Please remove an existing one or upgrade your plan."
            });
        }

        // Insert into DB
        const individual_job_post_id = await insertIndividualJobPost(connection, input);

        const responseData: SuccessResult = {
            success: true,
            individual_job_post_id,
            message: "Individual job post created successfully",
        };

        return response.status(201).json(responseData);

    } catch (error: any) {
        if (connection) await connection.rollback();

        logger.error("Unexpected error in createIndividualJobPost controller", {
            error,
            name: error?.name || "UnknownError",
            message: error?.message || "No message",
            stack: error?.stack || "No stack",
            cause: error?.cause || "No cause",
            ip,
        });

        return response.status(500).json({ error: "Internal server error." });

    } finally {
        if (connection) connection.release();
    }
};

// Input type for creating individual job post
export interface IndividualJobPostInput {
    user_id: number;
    role: string;
    worker_name?: string | null;
    worker_category?: string | null;
    years_of_experience?: number | null;
    location?: string | null;
    qualifications?: string | null;
    skill?: string | null;
}

// Validation result type
export interface ValidationResult {
    valid?: boolean;
    error?: string;
}

// Validate the individual job post input
export function validateIndividualJobPostInput(data: IndividualJobPostInput): ValidationResult {
    const { worker_name, worker_category, years_of_experience, location, qualifications, skill } = data;

    // All fields are optional, but at least one must be provided
    if (!worker_name && !worker_category && !years_of_experience && !location && !qualifications && !skill) {
        logger.warn("Individual job post validation failed: no fields provided", { data });
        return { error: "Please provide at least one field for the individual job post." };
    }

    // Additional validation could be added here (e.g., type checks)
    return { valid: true };
}

// Wla ni gigamit


// Insert a new individual job post
export async function insertIndividualJobPost(
    connection: PoolConnection,
    data: IndividualJobPostInput
): Promise<number> {
    const {
        user_id,
        worker_name,
        worker_category,
        years_of_experience,
        location,
        qualifications,
        skill,
    } = data;

    try {
        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO individual_job_post (
                user_id, status, jobpost_status, submitted_at,
                worker_name, worker_category, years_of_experience,
                location, qualifications, skill
            ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
            [
                user_id,
                'pending',      
                'pending',      
                worker_name ?? null,
                worker_category ?? null,
                years_of_experience ?? null,
                location ?? null,
                qualifications ?? null,
                skill ?? null,
            ]
        );


        return result.insertId;
    } catch (error: any) {
        logger.error("Failed to insert individual job post", { error, data });
        throw new Error(error?.message || "Database error while inserting individual job post");
    }
}
