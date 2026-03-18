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
import { hiresRecord } from './rejected-users.js';

type ManpowerRejectRequest = Request<{}, any, { applicant_id: number }, any> & {
  user?: AuthenticatedUser;
};


// ========================================
// MAIN FUNCTION: Reject Find Agency
// ========================================
export const rejectFindAgency = async (req: ManpowerRejectRequest, res: Response): Promise<Response> => {
  let connection: PoolConnection | undefined;
  const ip = req.ip;
  const role = req.user?.role;

  // Only manpower providers allowed
  if (role !== ROLE.MANPOWER_PROVIDER) {
    logger.warn('Non-manpower-provider tried to reject by applicant_id', { ip, role });
    return res.status(403).json({
      error: 'Forbidden: Only manpower providers can use this endpoint.',
    });
  }

  try {
    const employer_id = req.user?.user_id;
    const applicant_id = req.body?.applicant_id;

    if (!employer_id) {
      logger.warn('Unauthorized attempt to reject applicant', { ip });
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!Number.isFinite(applicant_id)) {
      logger.warn('Invalid applicant ID in rejectFindAgency', {
        employer_id,
        applicant_id,
        ip,
      });
      return res.status(400).json({ message: 'Invalid applicant ID' });
    }

    connection = await pool.getConnection();

    const existingApplication = await findExistingApplication(connection, applicant_id, employer_id);
    const acceptanceCheck = await checkAcceptanceStatus(connection, employer_id, applicant_id);
    const rejectedHire = await hiresRecord(connection, employer_id, applicant_id);

    if (rejectedHire.status === 'rejected' && rejectedHire.start_date && rejectedHire.end_date) {
      logger.warn('Applicant already rejected', {
        employer_id,
        applicant_id,
        hire_id: rejectedHire.hire_id,
        rejected_at: rejectedHire.rejected_at,
        ip,
      });

      return res.status(409).json({
        success: false,
        message: 'This applicant rejected the job offer.',
        alreadyRejected: true,
        rejectedAt: rejectedHire.rejected_at,
        rejectionReason: rejectedHire.rejection_reason,
        jobTitle: rejectedHire.job_title,
      });
    }

    let application_id: number | null = null;
    let job_title = 'a position';

    if (existingApplication) {
      application_id = existingApplication.application_id;
      job_title = existingApplication.job_title;

      const updated = await updateApplicationToRejected(
        connection,
        application_id,
        employer_id
      );

      if (updated) {
        logger.info('Application marked as rejected', {
          employer_id,
          application_id,
          applicant_id,
          ip,
        });
      }
    }

    if (!acceptanceCheck.canProceed) {
      logger.warn('Cannot reject applicant - acceptance exists', {
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

    await notifyUser(
      applicant_id,
      'APPLICATION REJECTED',
      `Your communication with the employer has been declined.`,
      'job_application',
      employer_id
    );

    // Delete any existing hire records and messages between the employer and applicant since the manpower provider is rejecting the applicant directly 
    // (without an application_id)
    const deleteResult = await deleteHireData(connection, employer_id, applicant_id);

    
    const rejectedHireResult = await createRejectedHire(connection, {
      employer_id,
      employee_id: applicant_id,
      rejection_reason: 'Employer declined communication'
    });

    logger.info('Manpower provider rejected applicant successfully (by applicant_id)', {
      employer_id,
      application_id: application_id || 'none',
      applicant_id,
      hadApplication: !!application_id,
      rejectedHireId: rejectedHireResult.success ? rejectedHireResult.hire_id : null,
      ip,
    });

    if (deleteResult.overallSuccess) {
      logger.info('Hire data deleted after applicant rejection', {
        employer_id,
        applicant_id,
        messagesDeleted: deleteResult.messageResult.deletedCount || 0,
        ip,
      });
    }

    return res.status(200).json({
      message: 'Applicant rejected successfully',
      hadApplication: !!application_id,
    });
  } catch (error: any) {
    logger.error('Failed to reject applicant by applicant_id', {
      ip,
      name: error?.name || 'UnknownError',
      message: error?.message || 'Unknown error during applicant rejection',
      stack: error?.stack || 'No stack trace',
      cause: error?.cause || 'No cause',
      error,
    });
    console.log('Error: ', error);
    return res.status(500).json({ message: 'Failed to reject applicant' });
  } finally {
    if (connection) connection.release();
  }
};



// ========================================
// HELPER FUNCTION 1: Find existing application
// ========================================
// GIGAMIT SAB NI SA reject-application
export const findExistingApplication = async (
  connection: PoolConnection,
  applicant_id: number,
  employer_id: number
): Promise<{ application_id: number; job_title: string } | null> => {
  const [rows] = await connection.query<RowDataPacket[]>(
    `
    SELECT 
      ja.application_id,
      ja.applicant_id,
      ja.application_status,
      jp.job_title
    FROM job_applications ja
    INNER JOIN job_post jp ON jp.job_post_id = ja.job_post_id
    WHERE ja.applicant_id = ?
    AND jp.user_id = ?
    AND ja.application_status != 'rejected'
    ORDER BY ja.applied_at DESC
    LIMIT 1
  `,
    [applicant_id, employer_id]
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0] as {
    application_id: number;
    application_status: string;
    job_title: string;
  };

  return {
    application_id: row.application_id,
    job_title: row.job_title,
  };
};

// ========================================
// HELPER FUNCTION 2: Update application status to rejected
// ========================================
const updateApplicationToRejected = async (
  connection: PoolConnection,
  application_id: number,
  employer_id: number
): Promise<boolean> => {
  const [result] = await connection.query<ResultSetHeader>(
    `UPDATE job_applications 
     SET application_status = 'rejected'
     WHERE application_id = ?
     AND employer_id = ?`,
    [application_id, employer_id]
  );

  return result.affectedRows > 0;
};