import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../../types/express/auth.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';
import { ROLE } from '../../../utils/roles.js';
import { notifyUser } from '../notification/notify-user.js';

// Make params optional
interface RejectApplicationParams {
  applicationId?: string;
}

// Request type with optional authenticated user
type RejectApplicationRequest = Request<RejectApplicationParams, any, any, any> & {
  user?: AuthenticatedUser;
};

const allowedRoles: (typeof ROLE)[keyof typeof ROLE][] = [
  ROLE.BUSINESS_EMPLOYER,
  ROLE.INDIVIDUAL_EMPLOYER,
  ROLE.MANPOWER_PROVIDER,
];

export const rejectApplication = async (
  req: RejectApplicationRequest,
  res: Response
): Promise<Response> => {
  let connection: PoolConnection | undefined;
  const ip = req.ip;
  const role = req.user?.role;

  if (!allowedRoles.includes(role as (typeof ROLE)[keyof typeof ROLE])) {
    logger.warn('Unauthorized role tried to rejecting an application', { ip, role });
    return res
      .status(403)
      .json({ error: 'Forbidden: Only authorized users can reject an applications.' });
  }

  try {
    const employerUserId = req.user?.user_id;
    const applicationId = req.params.applicationId ? parseInt(req.params.applicationId, 10) : NaN;

    if (!employerUserId) {
      logger.warn('Unauthorized attempt to reject application', { ip });
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!Number.isFinite(applicationId)) {
      logger.warn('Invalid application ID in rejectApplication', {
        employerUserId,
        applicationId,
        ip,
      });
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    connection = await pool.getConnection();

    // Fetch applicant details and job title from all three possible job post types
    const [rows] = await connection.query<RowDataPacket[]>(
      `
      SELECT 
        ja.applicant_id,
        COALESCE(jp.job_title, ijp.worker_name, tjp.worker_category) AS job_title,
        COALESCE(jp.user_id, ijp.user_id, tjp.user_id) AS employer_id
      FROM job_applications ja
      LEFT JOIN job_post jp ON jp.job_post_id = ja.job_post_id
      LEFT JOIN individual_job_post ijp ON ijp.individual_job_post_id = ja.individual_job_post_id
      LEFT JOIN team_job_post tjp ON tjp.team_job_post_id = ja.team_job_post_id
      WHERE ja.application_id = ?
      AND COALESCE(jp.user_id, ijp.user_id, tjp.user_id) = ?
      `,
      [applicationId, employerUserId]
    );

    if (rows.length === 0) {
      logger.warn('Application not found or not owned by employer', {
        employerUserId,
        applicationId,
        ip,
      });
      return res.status(404).json({ message: 'Application not found or not owned by employer' });
    }

    const { applicant_id, job_title } = rows[0] as { applicant_id: number; job_title: string };

    // Update the application status to rejected
    const [result] = await connection.query<ResultSetHeader>(
      `
      UPDATE job_applications ja
      LEFT JOIN job_post jp ON jp.job_post_id = ja.job_post_id
      LEFT JOIN individual_job_post ijp ON ijp.individual_job_post_id = ja.individual_job_post_id
      LEFT JOIN team_job_post tjp ON tjp.team_job_post_id = ja.team_job_post_id
      SET ja.application_status = 'rejected'
      WHERE ja.application_id = ?
      AND COALESCE(jp.user_id, ijp.user_id, tjp.user_id) = ?
      `,
      [applicationId, employerUserId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Application not found or not owned by employer' });
    }

    // Notify the applicant about the rejection
    await notifyUser(
      applicant_id,
      'APPLICATION REJECTED',
      `Your application for ${job_title} has been rejected.`,
      'job_application',
      employerUserId
    );

    return res.status(200).json({ message: 'Application rejected successfully' });
  } catch (error: any) {
    logger.error('Failed to reject application', {
      ip,
      name: error?.name || 'UnknownError',
      message: error?.message || 'Unknown error during application rejection',
      stack: error?.stack || 'No stack trace',
      cause: error?.cause || 'No cause',
      error,
    });
    return res.status(500).json({ message: 'Failed to reject application' });
  } finally {
    if (connection) connection.release();
  }
};