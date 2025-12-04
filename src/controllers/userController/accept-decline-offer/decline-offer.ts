import type { Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../../config/database-connection.js';
import { applicationDeclinedTemplate } from './decline-email.js';
import sendMail from '../../../service/email-handler.js';
import { ROLE } from '../../../utils/roles.js';

  interface DeclineOfferRequest {
    job_title: string;
    employer_name: string;
    rejection_reason?: string;
    message_id?: number;
    conversation_id?: number;
  }

 const allowedRoles = [
  ROLE.MANPOWER_PROVIDER,
  ROLE.BUSINESS_EMPLOYER,
  ROLE.INDIVIDUAL_EMPLOYER
];

export const declineOffer = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { 
      job_title, 
      employer_name, 
      rejection_reason,
      message_id,
      conversation_id
    }: DeclineOfferRequest = req.body;

    const userId = req.user?.user_id;
    
    const userRole = allowedRoles.includes(req.user?.role)
      ? req.user?.role
      : ROLE.JOBSEEKER; 

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Validate authentication
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

  // Get full name based on role
    let fullNameQuery = "";
    let fullNameParams = [userId];

    switch (req.user?.role) {
      case ROLE.JOBSEEKER:
        fullNameQuery = "SELECT full_name AS name FROM jobseeker WHERE jobseeker_id = ?";
        break;

      case ROLE.INDIVIDUAL_EMPLOYER:
        fullNameQuery = "SELECT full_name AS name FROM individual_employer WHERE individual_employer_id = ?";
        break;

      case ROLE.BUSINESS_EMPLOYER:
        fullNameQuery = "SELECT authorized_person AS name FROM business_employer WHERE business_employer_id = ?";
        break;

      case ROLE.MANPOWER_PROVIDER:
        fullNameQuery = "SELECT agency_authorized_person AS name FROM manpower_provider WHERE manpower_provider_id = ?";
        break;

      default:
        fullNameQuery = "SELECT email AS name FROM users WHERE user_id = ?";
    }

    const [nameRows] = await connection.execute<RowDataPacket[]>(fullNameQuery, fullNameParams);
    const fullName = nameRows[0]?.name ?? "User";


    // Validate required fields
    if (!job_title || !employer_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    await connection.beginTransaction();

    // Get employer_id from message
    let employerId: number | null = null;
    
    if (message_id) {
      const [messageRows] = await connection.execute<RowDataPacket[]>(
        'SELECT sender_id FROM messages WHERE message_id = ?',
        [message_id]
      );
      
      if (messageRows.length > 0) {
        employerId = messageRows[0]?.sender_id;
      }
    }

    if (!employerId) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid message_id: employer not found.'
      });
    }

    const emailHtml = applicationDeclinedTemplate({
      name: employer_name,
      position: job_title,
      company: employer_name,
      date: new Date().toLocaleDateString(),
      jobDetailsUrl: `${process.env.CLIENT_ORIGIN}/${userRole}/message`
    });

    // Check if hire record exists (consistent with accept offer)
    const [existingHire] = await connection.execute<RowDataPacket[]>(
      `SELECT hire_id FROM hires WHERE employer_id = ? AND employee_id = ?`,
      [employerId, userId]
    );

    if (existingHire.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Hire record does not exist. Cannot update.'
      });
    }

    const hireId = existingHire[0]?.hire_id;

    // Update existing hire record to rejected status
    await connection.execute(
      `UPDATE hires SET
        job_title = ?,
        status = 'rejected',
        message_id = ?,
        conversation_id = ?,
        rejection_reason = ?,
        rejected_at = NOW()
      WHERE hire_id = ?`,
      [
        job_title,
        message_id ?? null,
        conversation_id ?? null,
        rejection_reason ?? null,
        hireId
      ]
    );

    // Mark message as read
    if (message_id) {
      await connection.execute(
        `UPDATE messages 
         SET is_read = TRUE, 
             read_at = NOW() 
         WHERE message_id = ?`,
        [message_id]
      );
    }

    // Create notification for employer
    if (employerId) {
      await connection.execute(
        `INSERT INTO notifications (
          user_id,
          notifier_id,
          type,
          title,
          message,
          reference_id,
          reference_type
        ) VALUES (?, ?, 'hire', ?, ?, ?, 'message')`,
        [
          employerId,
          userId,
          'JOB OFFER DECLINED',
          `Your job offer for ${job_title} has been declined`,
          message_id,
        ]
      );
    }

      const [employerRows] = await connection.execute<RowDataPacket[]>(
        "SELECT email FROM users WHERE user_id = ?",
        [employerId]
      );

    const employerEmail = employerRows[0]?.email;

     await sendMail(
        employerEmail,
          "Your Job Application Has Been Rejected",
          emailHtml
      );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Job offer declined successfully',
      data: {
        hire_id: hireId,
        job_title,
        employer_name,
        status: 'rejected'
      }
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('Error declining job offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    connection.release();
  }
};