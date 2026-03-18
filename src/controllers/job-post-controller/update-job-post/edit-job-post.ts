import type { PoolConnection } from 'mysql2/promise';
import type { CustomRequest } from '../../../types/express/auth.js';
import type { Response } from 'express';
import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';
import { ROLE } from '../../../utils/roles.js';

const allowedRoles = [ROLE.BUSINESS_EMPLOYER, ROLE.INDIVIDUAL_EMPLOYER, ROLE.MANPOWER_PROVIDER];

export const editJobPost = async (req: CustomRequest, res: Response): Promise<void> => {
  const user_id = req.user?.user_id;
  const user_role = req.user?.role;

  if (!user_id) {
    res.status(401).json({ message: 'Unauthorized: User not authenticated' });
    return;
  }

  if (!user_role || !allowedRoles.includes(user_role)) {
    res.status(403).json({ message: 'Forbidden: You do not have permission to edit a job post' });
    return;
  }

  const {
    job_post_id,
    job_title,
    job_description,
    required_skill,
    location,
    salary_range,
    job_type,
    number_of_workers,
  } = req.body;

  if (!job_post_id) {
    res.status(400).json({ message: 'Job post ID is required' });
    return;
  }

  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();

    // Check if user role should update number_of_workers
    const shouldUpdateNumberOfWorkers = 
      user_role === ROLE.BUSINESS_EMPLOYER || user_role === ROLE.MANPOWER_PROVIDER;

    // Build dynamic query based on role
    let updateQuery: string;
    let queryParams: any[];

    if (shouldUpdateNumberOfWorkers) {
      // Include number_of_workers in update for business employers and manpower providers
      updateQuery = `UPDATE job_post
        SET job_title = ?, 
            job_description = ?, 
            required_skill = ?, 
            location = ?, 
            salary_range = ?, 
            job_type = ?, 
            number_of_worker = ?,
            jobpost_status = 'pending', 
            is_verified_jobpost = 0, 
            approved_at = NULL,
            status = 'pending'
        WHERE job_post_id = ? AND user_id = ?`;
      
      queryParams = [
        job_title,
        job_description,
        required_skill,
        location,
        salary_range,
        job_type,
        number_of_workers || null,
        job_post_id,
        user_id,
      ];
    } else {
      // Exclude number_of_workers for individual employers
      updateQuery = `UPDATE job_post
        SET job_title = ?, 
            job_description = ?, 
            required_skill = ?, 
            location = ?, 
            salary_range = ?, 
            job_type = ?, 
            jobpost_status = 'pending', 
            is_verified_jobpost = 0, 
            approved_at = NULL,
            status = 'pending'
        WHERE job_post_id = ? AND user_id = ?`;
      
      queryParams = [
        job_title,
        job_description,
        required_skill,
        location,
        salary_range,
        job_type,
        job_post_id,
        user_id,
      ];
    }

    // Execute the update query
    const [result] = await connection.query(updateQuery, queryParams);

    res.status(200).json({ message: 'Job post updated successfully', result });
  } catch (error: any) {
    logger.error('Failed to edit job post', {
      name: error?.name || 'UnknownError',
      message: error?.message || 'No message',
      stack: error?.stack || 'No stack trace',
      cause: error?.cause || 'No cause',
      user_id,
      user_role,
      ip: req.ip,
      job_post_id,
    });
    res.status(500).json({ message: 'Failed to edit job post' });
  } finally {
    if (connection) connection.release();
  }
};