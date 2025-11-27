import { getJobPostsByUserGrouped, type JobPostsByUser } from "./get-job-post-by-user-grouped-service.js";
import type { PoolConnection } from "mysql2/promise";
import type { CustomRequest } from "../../../types/express/auth.js";
import type { Response } from "express";
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";

export const jobPostsByUser = async (req: CustomRequest, res: Response): Promise<void> => {
    const user_id = req.user?.user_id;

    if (!user_id) {
        res.status(401).json({ message: "Unauthorized: User not authenticated" });
        return;
    }

    let connection: PoolConnection | undefined;

    try {
        connection = await pool.getConnection();
        const posts: JobPostsByUser = await getJobPostsByUserGrouped(connection, user_id);
        res.status(200).json(posts);
    } catch (error: any) {
        logger.error("Failed to fetch job posts by user", {
            name: error?.name || "UnknownError",
            message: error?.message || "No message",
            stack: error?.stack || "No stack trace",
            cause: error?.cause || "No cause",
            user_id,
            ip: req.ip,
        });
        res.status(500).json({ message: "Failed to fetch job posts" });
    } finally {
        if (connection) connection.release();
    }
};
