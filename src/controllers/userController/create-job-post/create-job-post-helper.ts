import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import logger from "../../../config/logger.js";

export interface JobPostInput {
    user_id: number;
    job_title: string;
    job_type: "Full-time" | "Part-time" | "Contract";
    salary_range: string;
    location: string;
    required_skill: string;
    job_description: string;
}

export interface ValidationResult {
    valid?: boolean;
    error?: string;
}

export function validateJobPostInput(data: JobPostInput): ValidationResult {
    const { job_title, job_type, salary_range, location, required_skill, job_description } = data;

    if (!job_title || !job_type || !salary_range || !location || !required_skill || !job_description) {
        logger.warn("Job post validation failed: missing fields", { data });
        return { error: "Please fill out all required fields." };
    }

    const validTypes: JobPostInput["job_type"][] = ["Full-time", "Part-time", "Contract"];
    
    if (!validTypes.includes(job_type)) {
        logger.warn("Job post validation failed: invalid job type", { job_type, data });
        return { error: "Invalid job type." };
    }

    return { valid: true };
}

// export async function countActiveJobPosts(connection: PoolConnection, user_id: number): Promise<number> {
//     try {
//         const [rows] = await connection.execute<RowDataPacket[]>(
//             `SELECT COUNT(*) AS total 
//              FROM job_post 
//              WHERE user_id = ? 
//              AND status NOT IN ('draft', 'rejected') 
//              AND jobpost_status != 'deleted'`,
//             [user_id]
//         );

//         const total = rows[0]?.total;
//         return typeof total === "number" ? total : 0;
//     } catch (error) {
//         logger.error("Failed to count active job posts", { error, user_id });
//         throw new Error("Database error while counting active job posts");
//     }
// }

export async function countActiveJobPostsAllTables(
  connection: PoolConnection,
  user_id: number
): Promise<number> {
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(`
      SELECT (
        (SELECT COUNT(*) FROM job_post 
          WHERE user_id = ? 
            AND status NOT IN ('draft', 'rejected') 
            AND jobpost_status != 'deleted') +
        (SELECT COUNT(*) FROM individual_job_post 
          WHERE user_id = ? 
            AND status NOT IN ('draft', 'rejected') 
            AND jobpost_status != 'deleted') +
        (SELECT COUNT(*) FROM team_job_post 
          WHERE user_id = ? 
            AND status NOT IN ('draft', 'rejected') 
            AND jobpost_status != 'deleted')
      ) AS total
    `, [user_id, user_id, user_id]);

    const total = rows[0]?.total;
    return typeof total === "number" ? total : 0;
  } catch (error) {
    logger.error("Failed to count active job posts across all tables", { error, user_id });
    throw new Error("Database error while counting active job posts");
  }
}

export async function insertJobPost(connection: PoolConnection, data: JobPostInput): Promise<number> {
    const { user_id, job_title, job_type, salary_range, location, required_skill, job_description } = data;

    try {
        const [result] = await connection.execute<ResultSetHeader>(
            `INSERT INTO job_post (
      user_id, job_title, job_type, salary_range,
      location, required_skill, job_description,
      status, submitted_at, rejection_reason, is_verified_jobpost, jobpost_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NULL, false, 'pending')`,
            [user_id, job_title, job_type, salary_range, location, required_skill, job_description]
        );

        return result.insertId;
    } catch (error) {
        throw new Error("Database error while inserting job post");
    }
}
