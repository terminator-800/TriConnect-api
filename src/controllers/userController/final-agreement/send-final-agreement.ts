import type { Request, Response } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '../../../config/database-connection.js';
import { ROLE } from '../../../utils/roles.js';
import { handleMessageUpload } from '../../../service/handle-message-upload-service.js';
import logger from '../../../config/logger.js';

interface FinalAgreementBody {
  conversation_id?: number;
  receiver_id?: number;
  agreement?: Record<string, unknown>;
}

export async function sendFinalAgreement(req: Request, res: Response) {
  const userId = req.user?.user_id;
  const role = req.user?.role;
  const body = req.body as FinalAgreementBody;
  const conversation_id = Number(body.conversation_id);
  const receiver_id = Number(body.receiver_id);
  const agreement = body.agreement;
  let connection: PoolConnection | undefined;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (role !== ROLE.INDIVIDUAL_EMPLOYER && role !== ROLE.BUSINESS_EMPLOYER) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!conversation_id || Number.isNaN(conversation_id) || !receiver_id || Number.isNaN(receiver_id)) {
    return res.status(400).json({ error: 'conversation_id and receiver_id are required.' });
  }
  if (!agreement || typeof agreement !== 'object') {
    return res.status(400).json({ error: 'agreement payload is required.' });
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [reqRows] = await connection.query<RowDataPacket[]>(
      `SELECT message_id, request_status
       FROM messages
       WHERE conversation_id = ?
         AND sender_id = ?
         AND receiver_id = ?
         AND message_type = 'request'
       ORDER BY created_at DESC, message_id DESC
       LIMIT 1`,
      [conversation_id, userId, receiver_id]
    );

    if (!reqRows.length || reqRows[0]?.request_status !== 'accepted') {
      await connection.rollback();
      return res
        .status(403)
        .json({ error: 'Final agreement is only allowed after the agency accepts the manpower request.' });
    }

    const express_message = JSON.stringify({ kind: 'final_agreement', ...agreement });
    const created = (await handleMessageUpload(connection, req, {
      sender_id: userId,
      receiver_id,
      express_message,
    })) as RowDataPacket;

    await connection.commit();
    return res.status(201).json({
      ok: true,
      conversation_id: created?.conversation_id ?? conversation_id,
      message_id: created?.message_id ?? null,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    logger.error('sendFinalAgreement failed', { error, userId, role, conversation_id, receiver_id });
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
}
