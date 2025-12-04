import type { Request, Response } from 'express';
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import pool from '../../../config/database-connection.js';
import { handleMessageUpload } from '../../../service/handle-message-upload-service.js';
import { notifyUser } from '../notification/notify-user.js';

interface HireApplicantRequest {
  employee_id: number;
  job_title: string;
  start_date: string;
  end_date: string;
  conversation_id: number;
  full_name: string;
  employer_name: string;
  hire_message: string;
}

export const hireApplicant = async (req: Request, res: Response): Promise<Response> => {
  const connection: PoolConnection = await pool.getConnection();
  
  try {
    const {
      employee_id,
      job_title,
      start_date,
      end_date,
      conversation_id,
      full_name,
      employer_name,
      hire_message
    } = req.body as HireApplicantRequest;

    // Get employer_id from authenticated user
    const employer_id = req.user?.user_id;

    if (!employer_id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Validate required fields
    if (!employee_id || !job_title || !start_date || !end_date || !conversation_id || !hire_message) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate dates
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    
    if (endDateObj <= startDateObj) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    await connection.beginTransaction();

    // 1. Insert into hires table
    const [hireResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO hires (
        employer_id, 
        employee_id, 
        job_title, 
        start_date, 
        end_date, 
        conversation_id,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [employer_id, employee_id, job_title, start_date, end_date, conversation_id]
    );

    const hire_id = hireResult.insertId;

    // 2. Send message to employee with hire offer using handleMessageUpload
    // This will create a message with message_type = 'hire'
    await handleMessageUpload(connection, req, {
      sender_id: employer_id,
      receiver_id: employee_id,
      hire_message: hire_message,
      job_title: job_title,
      full_name: full_name,
      employer_name: employer_name,
      start_date: start_date,
      end_date: end_date,
    });

    // 3. Create notification for employee about the hire offer
    const io = req.app.get('io');
    const userSocketMap = req.app.get('userSocketMap');
    const socketId = userSocketMap[employee_id];

    try {
      if (socketId) {
        io.to(socketId).emit('notification', {
          title: 'NEW HIRE OFFER',
          message: `${employer_name} has sent you a hire offer for ${job_title}. Check your messages for details.`,
          type: 'hire',
          notifier_id: employer_id,
          created_at: new Date(),
        });
      }
    } catch (socketError) {
      console.error('Failed to emit socket notification', { 
        employee_id, 
        socketError 
      });
    }

    await notifyUser(
      employee_id,
      'JOB OFFER CONFIRMATION',
      `${employer_name} has sent you a hire offer for ${job_title}. Check your messages for details.`,
      'hire',
      employer_id
    );

    await connection.commit();

    return res.status(200).json({
      success: true,
      message: 'Hire offer sent successfully',
      hire_id,
      data: {
        employee_id,
        job_title,
        start_date,
        end_date,
        status: 'pending'
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error hiring applicant:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to hire applicant',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    connection.release();
  }
};