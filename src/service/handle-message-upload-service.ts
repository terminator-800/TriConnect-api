import type { PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import logger from '../config/logger.js';

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
  project_description?: string;
  resume?: FileUpload;
  files?: FileUpload[];
}

export const handleMessageUpload = async (
  connection: PoolConnection,
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
      project_description,
      resume,
      files,
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
      project_description,
      resume,
      files
    );

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

    if (
      full_name ||
      phone_number ||
      email_address ||
      current_address ||
      cover_letter ||
      resume ||
      job_title
    ) {
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
    }

    if (
      employer_name ||
      company_name ||
      phone_number ||
      email_address ||
      project_location ||
      start_date ||
      project_description
    ) {
      const formattedStartDate = start_date
        ? typeof start_date === 'string'
          ? start_date
          : start_date.toISOString().slice(0, 19).replace('T', ' ')
        : null;

      await connection.query(
        `INSERT INTO messages (
          conversation_id, sender_id, receiver_id,
          employer_name, company_name, phone_number, email_address,
          project_location, start_date, project_description,
          message_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
