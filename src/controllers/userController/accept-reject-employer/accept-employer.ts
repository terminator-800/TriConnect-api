import type { Request, Response } from 'express';
import type { ResultSetHeader } from 'mysql2/promise';
import pool from '../../../config/database-connection.js';
import { getNotifierCredentials } from '../notification/get-notified.js';

export async function acceptEmployerHandler(req: Request, res: Response) {
  const { employerId, conversationId, referenceId } = req.body;

  const notifierId = req.user?.user_id; 
  if (!notifierId) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (!employerId || !conversationId) {
    return res.status(400).json({ ok: false, message: 'Missing employerId or conversationId' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch names
    const agency = await getNotifierCredentials(notifierId);
    const employer = await getNotifierCredentials(employerId);

    const title = "Manpower Request Accepted";
    const message = `${employer?.full_name || employer?.business_name || 'Employer'} your manpower request has been accepted by ${agency?.agency_name || agency?.full_name || 'Manpower Provider'}.`;
    const type = "system";
    const referenceType = "conversation";

    // Insert notification
    await connection.execute(
      `INSERT INTO notifications
        (user_id, notifier_id, title, message, type, reference_id, reference_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        employerId,
        notifierId,
        title,
        message,
        type,
        referenceId,
        referenceType
      ]
    );

    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE messages
       SET request_status = 'accepted',
           request_decided_at = NOW(),
           request_decided_by = ?
       WHERE message_id = (
         SELECT target.message_id
         FROM (
           SELECT m.message_id
           FROM messages m
           WHERE m.conversation_id = ?
             AND m.sender_id = ?
             AND m.receiver_id = ?
             AND m.message_type = 'request'
           ORDER BY m.created_at DESC, m.message_id DESC
           LIMIT 1
         ) AS target
       )`,
      [notifierId, conversationId, employerId, notifierId]
    );

    await connection.commit();
    res.json({ ok: true, updated: result.affectedRows });
  } catch (err) {
    console.error("acceptEmployer error:", err);
    if (connection) await connection.rollback();
    res.status(500).json({ ok: false });
  } finally {
    if (connection) connection.release();
  }
}
