import type { Request, Response } from 'express';
import pool from '../../../config/database-connection.js';
import type { ResultSetHeader } from 'mysql2';

export const rejectApplicant = async (req: Request, res: Response) => {
  try {
    const { applicant_id } = req.body;
    const employer_id = req.user?.user_id;
    console.log("BODY RECEIVED:", req.body);

    console.log('Reject Applicant Request:', {
      applicant_id,
      employer_id,
      body: req.body,
      user: req.user
    });

    if (!applicant_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: applicant_id'
      });
    }

    if (!employer_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: employer_id not found'
      });
    }

    // Find the most recent pending application from this applicant to this employer
    const [applications]: any = await pool.execute(
      `
      SELECT ja.application_id, ja.applicant_id
      FROM job_applications ja
      LEFT JOIN job_post jp ON ja.job_post_id = jp.job_post_id
      LEFT JOIN individual_job_post ijp ON ja.individual_job_post_id = ijp.individual_job_post_id
      LEFT JOIN team_job_post tjp ON ja.team_job_post_id = tjp.team_job_post_id
      WHERE ja.applicant_id = ? 
      AND (jp.user_id = ? OR ijp.user_id = ? OR tjp.user_id = ?)
      AND ja.application_status = 'pending'
      ORDER BY ja.applied_at DESC
      LIMIT 1
      `,
      [applicant_id, employer_id, employer_id, employer_id]
    );

    console.log('Found applications:', applications);

    if (applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No pending application found for this applicant'
      });
    }

    const application_id = applications[0].application_id;

    // Update application status to rejected
    const [result] = await pool.execute<ResultSetHeader>(
      `
      UPDATE job_applications 
      SET application_status = 'rejected'
      WHERE application_id = ?
      `,
      [application_id]
    );

    console.log('Update result:', result);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Failed to update application status'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Application rejected successfully',
      data: {
        application_id,
        applicant_id
      }
    });

  } catch (error) {
    console.error('Error rejecting application:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject application',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};