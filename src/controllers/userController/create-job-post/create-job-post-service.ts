
import { countActiveJobPostsAllTables, insertJobPost, validateJobPostInput } from "./create-job-post-helper.js";
import type { ValidationResult } from "./create-job-post-helper.js";
import type { PoolConnection } from "mysql2/promise";
import logger from "../../../config/logger.js";

export interface JobPostData {
    user_id: number;
    job_title: string;
    job_type: "Full-time" | "Part-time" | "Contract";
    salary_range: string;
    location: string;
    required_skill: string;
    job_description: string;
}

interface SuccessResult {
    success: true;
    job_post_id: number;
    message: string;
}

interface ErrorResult {
    error: string;
    details?: string;
}

export type CreateJobPostResult = SuccessResult | ErrorResult;

export async function createJobPosts(connection: PoolConnection, jobPostData: JobPostData): Promise<CreateJobPostResult> {

    const validation: ValidationResult = validateJobPostInput(jobPostData);

    if (validation.error) {
        logger.warn("Job post validation failed", { error: validation.error, jobPostData });
        return { error: validation.error };
    }

    const { user_id } = jobPostData;
    const maxAllowed = 3;

    try {
        const totalPosts: number = await countActiveJobPostsAllTables(connection, user_id);
        
        if (totalPosts >= maxAllowed) {
            logger.warn("Max active job posts reached", { user_id, totalPosts, maxAllowed });
            return {
                error: `You can only create up to ${maxAllowed} active job posts.`
            };
        }

        const job_post_id: number = await insertJobPost(connection, jobPostData);

        return {
            success: true,
            job_post_id,
            message: "Job post created successfully."
        };
    } catch (error: any) {
        return { error: "Database error occurred.", details: error.message };
    }
}
