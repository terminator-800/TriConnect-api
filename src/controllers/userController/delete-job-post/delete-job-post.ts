import dotenv from 'dotenv';
dotenv.config();
import type { Request, Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { getJobPostById } from '../../../service/job-post-by-id-service.js';
import { deleteJobPost } from './delete.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';
import { ROLE } from '../../../utils/roles.js';
import type { AuthenticatedUser } from '../../../types/express/auth.js';

// Allowed roles
const allowedRoles: typeof ROLE[keyof typeof ROLE][] = [
    ROLE.BUSINESS_EMPLOYER,
    ROLE.INDIVIDUAL_EMPLOYER,
    ROLE.MANPOWER_PROVIDER,
];

export const softDeleteJobPost = async (req: Request, res: Response) => {
    const deletedStatus = 'deleted';
    const jobPostId = Number(req.params.jobPostId);
    const ip = req.ip;
    const role = (req.user as AuthenticatedUser)?.role;

    if (isNaN(jobPostId)) {
        logger.warn('Invalid job post ID', { jobPostId: req.params.jobPostId, ip });
        return res.status(400).json({ error: 'Invalid job post ID' });
    }

    let connection: PoolConnection | undefined;

    if (!allowedRoles.includes(role)) {
        logger.warn("Unauthorized role tried to delete job post", { role, ip });
        return res.status(403).json({ error: "Forbidden: Only authorized employers can delete job posts." });
    }

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const jobPost = await getJobPostById(connection, jobPostId);

        if (!jobPost) {
            await connection.rollback();
            logger.warn('Job post not found', { jobPostId, ip });
            return res.status(404).json({ error: 'Job post not found' });
        }

        if (jobPost.jobpost_status === deletedStatus) {
            await connection.rollback();
            logger.warn('Job post already deleted', { jobPostId, ip });
            return res
                .status(400)
                .json({ error: 'Job post is already marked as deleted.' });
        }

        await deleteJobPost(connection, jobPostId);

        await connection.commit();

        return res.status(200).json({
            message: 'Job post marked as deleted. Will be removed after 1 month.',
        });
    } catch (error: any) {
        if (connection) await connection.rollback();
        logger.error("Error soft deleting job post", {
            error: error,
            name: error?.name || "UnknownError",
            message: error?.message || "No message",
            stack: error?.stack || "No stack trace",
            cause: error?.cause || "No cause",
            ip,
        });
        return res.status(500).json({ error: 'Internal server error' });
    } finally {
        try {
            if (connection) connection.release();
        } catch (releaseError) {
            logger.error('Failed to release database connection', { releaseError, jobPostId, ip });
        }
    }
};
