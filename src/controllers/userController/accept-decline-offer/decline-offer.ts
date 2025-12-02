import type { Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../../config/database-connection.js';


export const declineJobOffer = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { 
      job_title, 
      employer_name, 
      rejection_reason,
      message_id,
      conversation_id
    } = req.body;

    const userId = req.user?.user_id;

    // Get employer_id from message
    let employerId: number | null = null;
    
    if (message_id) {
      const [messageRows] = await connection.execute<RowDataPacket[]>(
        'SELECT sender_id FROM messages WHERE message_id = ?',
        [message_id]
      );
      
      if (messageRows.length > 0) {
        employerId = messageRows[0]!.sender_id;
      }
    }

    await connection.beginTransaction();

    // Update or insert hire record with rejected status
    await connection.execute(
      `INSERT INTO hires (
        employer_id, 
        employee_id, 
        job_title, 
        start_date, 
        end_date, 
        status, 
        message_id, 
        conversation_id,
        rejection_reason,
        rejected_at
      ) VALUES (?, ?, ?, NULL, NULL, 'rejected', ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        status = 'rejected',
        rejection_reason = ?,
        rejected_at = NOW()`,
      [
        employerId,
        userId,
        job_title,
        message_id,
        conversation_id,
        rejection_reason,
        rejection_reason
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
          'Job Offer Declined',
          `Your job offer for ${job_title} has been declined`,
          message_id,
        ]
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Job offer declined successfully'
    });

  } catch (error: any) {
    await connection.rollback();
    console.error('Error declining job offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};