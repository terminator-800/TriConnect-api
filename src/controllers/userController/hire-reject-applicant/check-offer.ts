import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

interface RejectedOfferCheck {
  canHire: boolean;
  message?: string;
  status?: string;
  hire_id?: number;
  application_id?: number;
  rejectedHires?: Array<{
    hire_id: number;
    job_title: string;
    rejected_at: string;
    rejection_reason?: string;
  }>;
  pendingHires?: Array<{
    hire_id: number;
    job_title: string;
    created_at: string;
  }>;
  acceptedHires?: Array<{
    hire_id: number;
    job_title: string;
    accepted_at: string;
  }>;
  rejectedApplications?: Array<{
    application_id: number;
    job_title: string;
    applied_at: string;
  }>;
}

/**
 * Checks if an applicant has any rejected applications or hire offers with the employer
 * @param connection - Database connection
 * @param employer_id - ID of the employer
 * @param applicant_id - ID of the applicant/employee
 * @returns Object indicating if hiring is allowed and any hire/application details
 */
export const checkOffer = async (
  connection: PoolConnection,
  employer_id: number,
  applicant_id: number
): Promise<RejectedOfferCheck> => {
  try {
    // Check for rejected job applications
    const [rejectedApps] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        ja.application_id,
        ja.applied_at,
        jp.job_title
      FROM job_applications ja
      INNER JOIN job_post jp ON ja.job_post_id = jp.job_post_id
      WHERE ja.applicant_id = ?
        AND ja.employer_id = ?
        AND ja.application_status = 'rejected'
      ORDER BY ja.applied_at DESC`,
      [applicant_id, employer_id]
    );

    // Query to find any existing hire offers from this employer to the applicant
    const [existingHires] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        hire_id,
        job_title,
        status,
        rejected_at,
        accepted_at,
        created_at,
        rejection_reason,
        start_date,   -- 👈 add this
        end_date      -- 👈 add this
      FROM hires
      WHERE employer_id = ?
        AND employee_id = ?
      ORDER BY created_at DESC`,
      [employer_id, applicant_id]
    );

    if (existingHires.length > 0) {
      // ✅ CHECK FOR REJECTED HIRES FIRST (applicant rejected the offer - HIGHEST PRIORITY)
      // const rejectedHires = existingHires.filter(hire => 
      //   hire.status === 'rejected' && 
      //   hire.rejection_reason != null && 
      //   hire.rejection_reason.trim() !== ''
      // );

      const rejectedByApplicant = existingHires.filter(hire => 
        hire.status === 'rejected' && 
        hire.rejection_reason != null && 
        hire.rejection_reason.trim() !== '' &&
         hire.start_date != null &&   // 👈 confirms a full offer was sent
        hire.end_date != null 
      );

      if (rejectedByApplicant.length > 0) {
        const firstRejected = rejectedByApplicant[0]!;
        return {
          canHire: false,
          message: `Cannot send another hire offer because the applicant declined your previous offer for "${firstRejected.job_title}". Reason: ${firstRejected.rejection_reason}`,
          status: 'rejected_by_applicant',
          hire_id: firstRejected.hire_id,
          rejectedHires: rejectedByApplicant.map(hire => ({
            hire_id: hire.hire_id,
            job_title: hire.job_title || 'Unknown Position',
            rejected_at: hire.rejected_at,
            rejection_reason: hire.rejection_reason
          }))
        };
      }

      if (rejectedByApplicant.length > 0) {
        const firstRejected = rejectedByApplicant[0]!;
        return {
          canHire: false,
          message: `Cannot send another hire offer because you already rejected this applicant.`,
          status: 'rejected_by_applicant',
          hire_id: firstRejected.hire_id,
          rejectedHires: rejectedByApplicant.map(hire => ({
            hire_id: hire.hire_id,
            job_title: hire.job_title || 'Unknown Position',
            rejected_at: hire.rejected_at,
          }))
        };
      }

       // ✅ CHECK FOR REJECTED HIRES BY EMPLOYER (employer cancelled/rejected - no rejection_reason)
      const rejectedByEmployer = existingHires.filter(hire => 
        hire.status === 'rejected' && 
        (hire.rejection_reason == null || hire.rejection_reason.trim() === '')
      );

      if (rejectedByEmployer.length > 0) {
        const firstRejected = rejectedByEmployer[0]!;
        return {
          canHire: false,
          message: `You have already rejected this applicant for "${firstRejected.job_title}". Cannot send another hire offer.`,
          status: 'rejected_by_employer',
          hire_id: firstRejected.hire_id,
          rejectedHires: rejectedByEmployer.map(hire => ({
            hire_id: hire.hire_id,
            job_title: hire.job_title || 'Unknown Position',
            rejected_at: hire.rejected_at,
            rejection_reason: hire.rejection_reason
          }))
        };
      }
      
      // if (rejectedHires.length > 0) {
      //   const firstRejected = rejectedHires[0]!;
      //   return {
      //     canHire: false,
      //     message: `Cannot send another hire offer because the applicant rejected your previous offer for "${firstRejected.job_title}". Reason: ${firstRejected.rejection_reason}`,
      //     status: 'rejected_by_applicant',
      //     hire_id: firstRejected.hire_id,
      //     rejectedHires: rejectedHires.map(hire => ({
      //       hire_id: hire.hire_id,
      //       job_title: hire.job_title || 'Unknown Position',
      //       rejected_at: hire.rejected_at,
      //       rejection_reason: hire.rejection_reason
      //     }))
      //   };
      // }

      // Check for pending offers
      const pendingHires = existingHires.filter(hire => hire.status === 'pending');
      if (pendingHires.length > 0) {
        const firstPending = pendingHires[0]!;
        return {
          canHire: false,
          message: `A hire offer for "${firstPending.job_title}" is already pending for this applicant`,
          status: 'pending',
          hire_id: firstPending.hire_id,
          pendingHires: pendingHires.map(hire => ({
            hire_id: hire.hire_id,
            job_title: hire.job_title || 'Unknown Position',
            created_at: hire.created_at
          }))
        };
      }

      // Check for accepted offers
      const acceptedHires = existingHires.filter(hire => hire.status === 'accepted');
      if (acceptedHires.length > 0) {
        const firstAccepted = acceptedHires[0]!;
        return {
          canHire: false,
          message: `This applicant has already accepted your offer for "${firstAccepted.job_title}"`,
          status: 'accepted',
          hire_id: firstAccepted.hire_id,
          acceptedHires: acceptedHires.map(hire => ({
            hire_id: hire.hire_id,
            job_title: hire.job_title || 'Unknown Position',
            accepted_at: hire.accepted_at
          }))
        };
      }

      // Check for active, completed, or terminated offers
      const activeStatusHires = existingHires.filter(hire => 
        hire.status === 'active' || hire.status === 'completed' || hire.status === 'terminated'
      );

      if (activeStatusHires.length > 0) {
        const firstActiveStatus = activeStatusHires[0]!;
        return {
          canHire: false,
          message: `There is already a hire record with status "${firstActiveStatus.status}" for this applicant`,
          status: firstActiveStatus.status,
          hire_id: firstActiveStatus.hire_id
        };
      }
    }

    // ✅ CHECK FOR REJECTED APPLICATIONS (employer rejected their application - LOWER PRIORITY)
    if (rejectedApps.length > 0) {
      const firstRejectedApp = rejectedApps[0]!;
      return {
        canHire: false,
        message: `This applicant's application for "${firstRejectedApp.job_title}" was rejected. Cannot send hire offer to rejected applicants.`,
        status: 'application_rejected',
        application_id: firstRejectedApp.application_id,
        rejectedApplications: rejectedApps.map(app => ({
          application_id: app.application_id,
          job_title: app.job_title || 'Unknown Position',
          applied_at: app.applied_at
        }))
      };
    }

    return {
      canHire: true
    };

  } catch (error) {
    console.error('Error checking rejected offers:', error);
    throw new Error('Failed to verify applicant eligibility');
  }
};