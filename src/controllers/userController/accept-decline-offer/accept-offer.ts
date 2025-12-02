import type { Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '../../../config/database-connection.js';

// Types
interface AcceptOfferRequest {
  job_title: string;
  employer_name: string;
  full_name: string;
  start_date: string;
  end_date: string;
  accepted_at: string;
  message_id?: number;
  conversation_id?: number;
}

// Controller for accepting job offer
export const acceptOffer = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  
  try {
    const { 
      job_title, 
      employer_name, 
      full_name, 
      start_date, 
      end_date, 
      accepted_at,
      message_id,
      conversation_id
    }: AcceptOfferRequest = req.body;

    const userId = req.user?.user_id; 
    if (!userId) {
        await connection.rollback();
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userRole = req.user?.role;
    console.log(req.body, "REQ BODY");

    const formatMySQLDate = (value: string | Date) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
    };


    const mysqlStartDate = formatMySQLDate(start_date);
    const mysqlEndDate = formatMySQLDate(end_date);
    const mysqlAcceptedAt = accepted_at 
    ? formatMySQLDate(accepted_at) 
    : formatMySQLDate(new Date().toISOString());

    // Validate required fields
    if (!job_title || !employer_name || !full_name || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Validate dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    await connection.beginTransaction();

    // 1. Get the employer_id from the message or conversation
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

   // 2. Update the hires table - UPDATE ONLY (no insert)
        const [existingHire] = await connection.execute<RowDataPacket[]>(
        `SELECT hire_id FROM hires WHERE employer_id = ? AND employee_id = ?`,
        [employerId, userId]
        );

        if (existingHire.length === 0) {
        await connection.rollback();
        return res.status(400).json({
            success: false,
            message: 'Hire record does not exist. Cannot update since patch-only mode.'
        });
        }

        const hireId = existingHire[0]?.hire_id;

        // Perform UPDATE
        await connection.execute(
        `UPDATE hires SET
            job_title = ?,
            start_date = ?,
            end_date = ?,
            status = 'accepted',
            message_id = ?,
            conversation_id = ?,
            accepted_at = ?
        WHERE hire_id = ?`,
        [
            job_title,
            mysqlStartDate,
            mysqlEndDate,
            message_id ?? null,
            conversation_id ?? null,
            mysqlAcceptedAt,
            hireId
        ]
        );



    // 3. Update user employment status
    await connection.execute(
      `UPDATE users 
       SET employment_status = 'hired',
           employed_start_date = ?,
           employed_end_date = ?,
           employer_id = ?
       WHERE user_id = ?`,
        [mysqlStartDate, mysqlEndDate, employerId, userId]
    );

    // 4. Update the message as read (if message_id exists)
    if (message_id) {
      await connection.execute(
        `UPDATE messages 
         SET is_read = TRUE, 
             read_at = NOW() 
         WHERE message_id = ?`,
        [message_id]
      );
    }

    // 5. Create notification for employer
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
          'JOB OFFER CONFIRMATION',
          `${full_name} has accepted your job offer for ${job_title}`,
          message_id,
        ]
      );
    }

    await connection.commit();

    return res.status(200).json({
    success: true,
    message: 'Job offer accepted successfully',
    data: {
        hire_id: hireId,
        job_title,
        employer_name,
        start_date: startDate,
        end_date: endDate,
        status: 'accepted',
        employment_status: 'hired'
    }
    });


  } catch (error: any) {
    await connection.rollback();
    console.error('Error accepting job offer:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    connection.release();
  }
};

