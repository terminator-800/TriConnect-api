import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

interface AcceptanceCheck {
  hasAcceptedHire: boolean;
  hasAcceptedApplication: boolean;
  canProceed: boolean;
  message?: string;
  acceptedHire?: {
    hire_id: number;
    job_title: string;
    accepted_at: string;
    start_date: string;
    end_date: string;
  };
  acceptedApplication?: {
    application_id: number;
    job_title: string;
    applied_at: string;
  };
}

/**
 * Checks if an applicant has any accepted hire offers or job applications with the employer
 * @param connection - Database connection
 * @param employer_id - ID of the employer
 * @param applicant_id - ID of the applicant/employee
 * @returns Object indicating acceptance status and details
 */
export const checkAcceptanceStatus = async (
  connection: PoolConnection,
  employer_id: number,
  applicant_id: number
): Promise<AcceptanceCheck> => {
  try {
    // Check for accepted hire offers
    const [acceptedHires] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        hire_id,
        job_title,
        start_date,
        end_date,
        accepted_at
      FROM hires
      WHERE employer_id = ?
        AND employee_id = ?
        AND status = 'accepted'
      ORDER BY accepted_at DESC
      LIMIT 1`,
      [employer_id, applicant_id]
    );

    // Check for accepted job applications
    const [acceptedApps] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        ja.application_id,
        ja.applied_at,
        jp.job_title
      FROM job_applications ja
      INNER JOIN job_post jp ON ja.job_post_id = jp.job_post_id
      WHERE ja.applicant_id = ?
        AND ja.employer_id = ?
        AND ja.application_status = 'accepted'
      ORDER BY ja.applied_at DESC
      LIMIT 1`,
      [applicant_id, employer_id]
    );

    const hasAcceptedHire = acceptedHires.length > 0;
    const hasAcceptedApplication = acceptedApps.length > 0;

    // Build response object
    const result: AcceptanceCheck = {
      hasAcceptedHire,
      hasAcceptedApplication,
      canProceed: !hasAcceptedHire && !hasAcceptedApplication
    };

    // Add accepted hire details if exists
    if (hasAcceptedHire) {
      const hire = acceptedHires[0]!;
      result.acceptedHire = {
        hire_id: hire.hire_id,
        job_title: hire.job_title,
        accepted_at: hire.accepted_at,
        start_date: hire.start_date,
        end_date: hire.end_date
      };
      result.message = `This applicant has already accepted your hire offer for "${hire.job_title}"`;
    }

    // Add accepted application details if exists
    if (hasAcceptedApplication) {
      const app = acceptedApps[0]!;
      result.acceptedApplication = {
        application_id: app.application_id,
        job_title: app.job_title,
        applied_at: app.applied_at
      };
      
      // Override message if application is accepted (might be more relevant)
      if (!hasAcceptedHire) {
        result.message = `This applicant's application for "${app.job_title}" has already been accepted`;
      }
    }

    // If both exist, combine message
    if (hasAcceptedHire && hasAcceptedApplication) {
      result.message = `You already hired this applicant for "${result.acceptedHire!.job_title}" and also accepted their application for "${result.acceptedApplication!.job_title}". You cannot reject the application.`;
    }

    return result;

  } catch (error) {
    console.error('Error checking acceptance status:', error);
    throw new Error('Failed to verify acceptance status');
  }
};