import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../../types/express/auth.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';
import { ROLE } from '../../../utils/roles.js';
import { notifyUser } from '../notification/notify-user.js';
import { deleteHireData } from './delete-hire-records.js';
import { checkAcceptanceStatus } from './check-acceptance-status.js';
import { createRejectedHire } from './rejected-users.js';

// ========================================
// FUNCTION 1: Standard rejection (requires application_id)
// Used by: Business Employer, Individual Employer, Manpower Provider
// ========================================
interface RejectApplicationParams {
  application_id?: string;
}

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
    const employer_id = req.user?.user_id;
    const application_id = req.params.application_id ? parseInt(req.params.application_id, 10) : NaN;

    if (!employer_id) {
      logger.warn('Unauthorized attempt to reject application', { ip });
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!Number.isFinite(application_id)) {
      logger.warn('Invalid application ID in rejectApplication', {
        employer_id,
        application_id,
        ip,
      });
      return res.status(400).json({ message: 'Invalid application ID' });
    }

    connection = await pool.getConnection();

    // Fetch applicant details and job title
    const [rows] = await connection.query<RowDataPacket[]>(
      `
      SELECT 
        ja.application_id,
        ja.applicant_id,
        ja.application_status,
        jp.job_title,
        jp.user_id AS employer_id
      FROM job_applications ja
      INNER JOIN job_post jp ON jp.job_post_id = ja.job_post_id
      WHERE ja.application_id = ?
      AND jp.user_id = ?
    `,
      [application_id, employer_id]
    );

    if (rows.length === 0) {
      logger.warn('Application not found or not owned by employer', {
        employer_id,
        application_id,
        ip,
      });
      return res.status(404).json({ message: 'Application not found or not owned by employer' });
    }

    const { applicant_id, job_title, application_status } = rows[0] as {
      applicant_id: number;
      job_title: string;
      application_status: string;
    };

    // 🔥 CHECK IF ALREADY REJECTED
    if (application_status === 'rejected') {
      logger.info('Attempted to reject already rejected application', {
        employer_id,
        application_id,
        ip,
      });
      return res.status(400).json({
        message: 'This applicant has already been rejected',
      });
    }

    // ✅ CHECK IF HIRE OR APPLICATION IS ALREADY ACCEPTED
    const acceptanceCheck = await checkAcceptanceStatus(connection, employer_id, applicant_id);

    if (!acceptanceCheck.canProceed) {
      logger.warn('Cannot reject application - acceptance exists', {
        employer_id,
        applicant_id,
        application_id,
        hasAcceptedHire: acceptanceCheck.hasAcceptedHire,
        hasAcceptedApplication: acceptanceCheck.hasAcceptedApplication,
        ip,
      });

      return res.status(409).json({
        success: false,
        message: acceptanceCheck.message,
        hasAcceptedHire: acceptanceCheck.hasAcceptedHire,
        hasAcceptedApplication: acceptanceCheck.hasAcceptedApplication,
        acceptedHire: acceptanceCheck.acceptedHire,
        acceptedApplication: acceptanceCheck.acceptedApplication,
      });
    }

    // Update the application status to rejected
    const [result] = await connection.query<ResultSetHeader>(
      `UPDATE job_applications 
       SET application_status = 'rejected'
       WHERE application_id = ?
       AND employer_id = ?`,
      [application_id, employer_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Application not found or not owned by employer' });
    }

   await createRejectedHire(connection, {
      employer_id,
      employee_id: applicant_id,
      rejection_reason: 'Employer declined application'
    });

    // Notify the applicant about the rejection
    await notifyUser(
      applicant_id,
      'APPLICATION REJECTED',
      `Your application for ${job_title} has been rejected.`,
      'job_application',
      employer_id
    );

    

    logger.info('Application rejected successfully', {
      employer_id,
      application_id,
      applicant_id,
      ip,
    });

    const deleteResult = await deleteHireData(connection, employer_id, applicant_id);

    if (deleteResult.overallSuccess) {
      logger.info('Hire data deleted after application rejection', {
        employer_id,
        applicant_id,
        messagesDeleted: deleteResult.messageResult.deletedCount || 0,
        // offersDeleted: deleteResult.offerResult.deletedCount || 0,
        ip,
      });
    }

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
    console.log('Error: ', error);
    return res.status(500).json({ message: 'Failed to reject application' });
  } finally {
    if (connection) connection.release();
  }
};


export interface ApplicationDetails extends RowDataPacket {
  application_id: number;
  applicant_id: number;
  application_status: string;
  job_title: string;
  employer_id: number;
}

export async function getApplicationDetails(
  connection: PoolConnection,
  application_id: number,
  employer_id: number
): Promise<ApplicationDetails | null> {
  const [rows] = await connection.query<ApplicationDetails[]>(
    `
      SELECT 
        ja.application_id,
        ja.applicant_id,
        ja.application_status,
        jp.job_title,
        jp.user_id AS employer_id
      FROM job_applications ja
      INNER JOIN job_post jp 
        ON jp.job_post_id = ja.job_post_id
      WHERE ja.application_id = ?
        AND jp.user_id = ?
    `,
    [application_id, employer_id]
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0]!;
}
