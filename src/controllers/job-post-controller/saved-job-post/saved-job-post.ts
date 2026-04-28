import type { Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';
import type { CustomRequest } from '../../../types/express/auth.js';
import { ROLE } from '../../../utils/roles.js';
import {
  getSavedJobPosts,
  saveJobPost,
  unsaveJobPost,
} from './saved-job-post-service.js';

function validateJobPostId(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) return null;
  return num;
}

export const createSavedJobPost = async (req: CustomRequest, res: Response): Promise<void> => {
  let connection: PoolConnection | undefined;

  try {
    const userId = req.user?.user_id;
    const role = req.user?.role;
    const jobPostId = validateJobPostId(req.body?.job_post_id);

    if (!userId || !role) {
      res.status(401).json({ error: 'Unauthorized: Invalid user token or role' });
      return;
    }

    if (role !== ROLE.JOBSEEKER) {
      res.status(403).json({ error: 'Forbidden: Only jobseekers can save job posts' });
      return;
    }

    if (!jobPostId) {
      res.status(400).json({ error: 'Invalid or missing job_post_id' });
      return;
    }

    connection = await pool.getConnection();
    await saveJobPost(connection, userId, jobPostId);

    res.status(201).json({ message: 'Job post saved successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message.includes('not found') ? 404 : 500;

    logger.error('Failed to save job post', {
      message,
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip,
      user_id: req.user?.user_id,
      job_post_id: req.body?.job_post_id,
    });

    res.status(statusCode).json({
      error: statusCode === 404 ? 'Job post not found or unavailable' : 'Failed to save job post',
    });
  } finally {
    if (connection) connection.release();
  }
};

export const removeSavedJobPost = async (req: CustomRequest, res: Response): Promise<void> => {
  let connection: PoolConnection | undefined;

  try {
    const userId = req.user?.user_id;
    const role = req.user?.role;
    const jobPostId = validateJobPostId(req.params?.job_post_id);

    if (!userId || !role) {
      res.status(401).json({ error: 'Unauthorized: Invalid user token or role' });
      return;
    }

    if (role !== ROLE.JOBSEEKER) {
      res.status(403).json({ error: 'Forbidden: Only jobseekers can unsave job posts' });
      return;
    }

    if (!jobPostId) {
      res.status(400).json({ error: 'Invalid or missing job_post_id' });
      return;
    }

    connection = await pool.getConnection();
    const removed = await unsaveJobPost(connection, userId, jobPostId);

    if (!removed) {
      res.status(404).json({ error: 'Saved job post not found' });
      return;
    }

    res.status(200).json({ message: 'Saved job post removed successfully' });
  } catch (error: unknown) {
    logger.error('Failed to remove saved job post', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip,
      user_id: req.user?.user_id,
      job_post_id: req.params?.job_post_id,
    });
    res.status(500).json({ error: 'Failed to remove saved job post' });
  } finally {
    if (connection) connection.release();
  }
};

export const savedJobPosts = async (req: CustomRequest, res: Response): Promise<void> => {
  let connection: PoolConnection | undefined;

  try {
    const userId = req.user?.user_id;
    const role = req.user?.role;

    if (!userId || !role) {
      res.status(401).json({ error: 'Unauthorized: Invalid user token or role' });
      return;
    }

    if (role !== ROLE.JOBSEEKER) {
      res.status(403).json({ error: 'Forbidden: Only jobseekers can access saved job posts' });
      return;
    }

    connection = await pool.getConnection();
    const jobs = await getSavedJobPosts(connection, userId);
    res.status(200).json(jobs);
  } catch (error: unknown) {
    logger.error('Failed to fetch saved job posts', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ip: req.ip,
      user_id: req.user?.user_id,
    });
    res.status(500).json({ error: 'Failed to fetch saved job posts' });
  } finally {
    if (connection) connection.release();
  }
};
