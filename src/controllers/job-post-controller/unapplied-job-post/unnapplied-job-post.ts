import { getUnappliedJobPosts, type FlattenedJobPost } from "./get-unnapplied-job-post-service.js";
import type { PoolConnection } from "mysql2/promise";
import type { CustomRequest } from "../../../types/express/auth.js";
import type { Response } from "express";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";

export const unappliedJobPosts = async (req: CustomRequest, res: Response): Promise<void> => {
    let connection: PoolConnection | undefined;

    try {
        connection = await pool.getConnection();

        const applicant_id = req.user?.user_id;
        const role = req.user?.role;

        if (!applicant_id || !role) {
            res.status(401).json({ error: "Unauthorized: Invalid user token or role" });
            return;
        }

        if (role !== ROLE.JOBSEEKER && role !== ROLE.MANPOWER_PROVIDER) {
            res.status(403).json({ error: "Forbidden: Only jobseekers and manpower providers can access this endpoint" });
            return;
        }

        if (process.env.NODE_ENV !== "production") {

        }

        const jobPosts: FlattenedJobPost[] = await getUnappliedJobPosts(connection, applicant_id);
        res.status(200).json(jobPosts);
    } catch (error: any) {
        logger.error("Failed to fetch unapplied job posts", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
            cause: error?.cause,
            ip: req.ip,
        });
        res.status(500).json({ error: "Failed to fetch unapplied job posts" });
    } finally {
        if (connection) connection.release();
    }
};
