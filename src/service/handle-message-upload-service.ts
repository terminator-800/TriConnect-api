import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import logger from '../config/logger.js';
import { notifyUser } from '../controllers/userController/notification/notify-user.js';

interface FileUpload {
  path: string;
}

interface HandleMessageUploadParams {
  sender_id: number;
  receiver_id: number;
  message?: string;
  cover_letter?: string;
  full_name?: string;
  phone_number?: string;
  email_address?: string;
  current_address?: string;
  job_title?: string;
  employer_name?: string;
  company_name?: string;
  project_location?: string;
  start_date?: string | Date;
  end_date?: string | Date; 
  project_description?: string;
  hire_message?: string;
  resume?: FileUpload;
  files?: FileUpload[];
}

export const handleMessageUpload = async (
  connection: PoolConnection,
  req: any, 
  params: HandleMessageUploadParams
) => {
  try {
    const {
      sender_id,
      receiver_id,
      message,
      cover_letter,
      full_name,
      phone_number,
      email_address,
      current_address,
      job_title,
      employer_name,
      company_name,
      project_location,
      start_date,
      end_date,
      project_description,
      resume,
      files,
      hire_message,
    } = params;
    console.log(
      sender_id,
      receiver_id,
      message,
      cover_letter,
      full_name,
      phone_number,
      email_address,
      current_address,
      job_title,
      employer_name,
      company_name,
      project_location,
      start_date,
      end_date,
      project_description,
      resume,
      files,
      hire_message
    );

      // Format start_date once at the beginning
    const formattedStartDate = start_date
      ? typeof start_date === 'string'
        ? start_date
        : start_date.toISOString().slice(0, 19).replace('T', ' ')
      : null;

       const formattedEndDate = end_date
      ? typeof end_date === 'string'
        ? end_date
        : end_date.toISOString().slice(0, 19).replace('T', ' ')
      : null;

    // Determine conversation
    const user_small_id = Math.min(sender_id, receiver_id);
    const user_large_id = Math.max(sender_id, receiver_id);

    const [existingRows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM conversations WHERE user_small_id = ? AND user_large_id = ?`,
      [user_small_id, user_large_id]
    );

    let conversation_id: number;

    if (existingRows.length > 0 && existingRows[0]) {
      conversation_id = existingRows[0].conversation_id;
    } else {
      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO conversations (user1_id, user2_id, user_small_id, user_large_id)
         VALUES (?, ?, ?, ?)`,
        [sender_id, receiver_id, user_small_id, user_large_id]
      );
      conversation_id = result.insertId;
    }
  
    const io = req.app.get('io');
    const userSocketMap = req.app.get('userSocketMap');
    const socketId = userSocketMap[sender_id];

   // FOR JOB APPLICATION 
    if (full_name && current_address && cover_letter && resume) {
      await connection.query(
        `INSERT INTO messages (
          conversation_id, sender_id, receiver_id,
          full_name, phone_number, email_address, current_address, cover_letter, resume, job_title,
          message_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversation_id,
          sender_id,
          receiver_id,
          full_name ?? null,
          phone_number ?? null,
          email_address ?? null,
          current_address ?? null,
          cover_letter ?? null,
          resume ? resume.path.replace(/\\/g, '/') : null,
          job_title ?? null,
          'apply',
        ]
      );
          try {
            if (socketId) {
              io.to(socketId).emit('notification', {
                title: 'NEW APPLICATION',
                message: `${full_name} applied for ${job_title}. Check your messages for details.`,
                type: 'job_application',
                notifier_id: sender_id,
                created_at: new Date(),
              });
            }
          } catch (socketError) {
            console.error('Failed to emit socket notification', { 
              sender_id, 
              socketError 
            });
          }
      
          await notifyUser(
            receiver_id,
            'NEW APPLICATION',
            `${full_name} applied for ${job_title}. Check your messages for details.`,
            'job_application',
            sender_id
          );
    }
    // FOR HIRE REQUEST
    // NAA NANI NOTIF
    else if (start_date && end_date && hire_message) {
      await connection.query(
        `INSERT INTO messages (
          conversation_id, sender_id, receiver_id,
          employer_name, full_name, job_title, start_date, end_date,
          hire_message, message_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversation_id,
          sender_id,
          receiver_id,
          employer_name ?? null,
          full_name ?? null,
          job_title ?? null,
          formattedStartDate,
          formattedEndDate,
          hire_message ?? null,
          'hire',
        ]
      );
    }

    // FOR REQUEST MANPOWER
    // NO NOTIF YET
    else if (employer_name && company_name && project_location && project_description) {
      await connection.query(
        `INSERT INTO messages (
          conversation_id, sender_id, receiver_id,
          employer_name, company_name, phone_number, email_address,
          project_location, start_date, project_description, job_title,
          message_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          conversation_id,
          sender_id,
          receiver_id,
          employer_name ?? null,
          company_name ?? null,
          phone_number ?? null,
          email_address ?? null,
          project_location ?? null,
          formattedStartDate,
          project_description ?? null,
          job_title ?? null,
          'request',
        ]
      );
    }
   

    // Insert optional text message
    if (message && message.trim() !== '') {
      await connection.query(
        `INSERT INTO messages (
          conversation_id, sender_id, receiver_id,
          message_text, message_type
        ) VALUES (?, ?, ?, ?, ?)`,
        [conversation_id, sender_id, receiver_id, message, 'text']
      );
    }

    // Insert files
    if (files && files.length > 0) {
      for (const file of files) {
        const file_url = file.path.replace(/\\/g, '/');
        await connection.query(
          `INSERT INTO messages (
            conversation_id, sender_id, receiver_id, message_type, file_url
          ) VALUES (?, ?, ?, ?, ?)`,
          [conversation_id, sender_id, receiver_id, 'file', file_url]
        );
      }
    }

    // Return latest message
    const [newMessageRows] = await connection.query<RowDataPacket[]>(
      `SELECT * FROM messages 
       WHERE conversation_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [conversation_id]
    );

    const latestMessage = newMessageRows?.[0];

    if (!latestMessage) {
      logger.error('Failed to retrieve the latest message.', {
        sender_id,
        receiver_id,
        conversation_id,
      });
      throw new Error('Failed to retrieve the latest message.');
    }

    return latestMessage;
  } catch (error) {
    console.error('REAL ERROR:', error);
    logger.error('Failed to handle message upload', { error });
    throw new Error('Failed to handle message upload.');
  }
};
