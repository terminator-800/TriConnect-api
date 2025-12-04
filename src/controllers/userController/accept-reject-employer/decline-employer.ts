import type { Request, Response } from 'express';
import pool from '../../../config/database-connection.js';
import { getNotifierCredentials } from '../notification/get-notified.js';

export async function declineEmployerHandler(req: Request, res: Response) {
  const { employerId, conversationId, referenceId } = req.body;

  const notifierId = req.user?.user_id; 
  if (!notifierId) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch names
    const agency = await getNotifierCredentials(notifierId);
    const employer = await getNotifierCredentials(employerId);

    const title = "Manpower Request Declined";
    const message = `${employer?.full_name || employer?.business_name || 'Employer'} your manpower request has been declined by ${agency?.agency_name || agency?.full_name || 'Manpower Provider'}.`;
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

    await connection.commit();
    res.json({ ok: true });
  } catch (err) {
    console.error("declineEmployer error:", err);
    if (connection) await connection.rollback();
    res.status(500).json({ ok: false });
  } finally {
    if (connection) connection.release();
  }
}
