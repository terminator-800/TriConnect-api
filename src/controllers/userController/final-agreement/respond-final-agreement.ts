import type { Request, Response } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '../../../config/database-connection.js';
import { ROLE } from '../../../utils/roles.js';
import { handleMessageUpload } from '../../../service/handle-message-upload-service.js';
import logger from '../../../config/logger.js';

interface RespondBody {
  conversation_id?: number;
  receiver_id?: number;
  agreement_message_id?: number;
  decision?: 'accepted' | 'declined';
}

function safeParse(input: string | null | undefined): any {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export async function respondFinalAgreement(req: Request, res: Response) {
  const userId = req.user?.user_id;
  const role = req.user?.role;
  const body = req.body as RespondBody;
  const conversation_id = Number(body.conversation_id);
  const receiver_id = Number(body.receiver_id);
  const agreement_message_id = Number(body.agreement_message_id);
  const decision = body.decision;
  let connection: PoolConnection | undefined;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (role !== ROLE.MANPOWER_PROVIDER) return res.status(403).json({ error: 'Forbidden' });
  if (!conversation_id || !receiver_id || !agreement_message_id) {
    return res
      .status(400)
      .json({ error: 'conversation_id, receiver_id and agreement_message_id are required.' });
  }
  if (decision !== 'accepted' && decision !== 'declined') {
    return res.status(400).json({ error: 'decision must be accepted or declined.' });
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [agreementRows] = await connection.query<RowDataPacket[]>(
      `SELECT message_id, express_message
       FROM messages
       WHERE message_id = ?
         AND conversation_id = ?
         AND sender_id = ?
         AND receiver_id = ?
         AND message_type = 'express'
       LIMIT 1`,
      [agreement_message_id, conversation_id, receiver_id, userId]
    );

    if (!agreementRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Final agreement message not found.' });
    }

    const agreementPayload = safeParse(agreementRows[0]?.express_message);
    if (agreementPayload?.kind !== 'final_agreement') {
      await connection.rollback();
      return res.status(400).json({ error: 'Target message is not a final agreement.' });
    }

    const [existingResponseRows] = await connection.query<RowDataPacket[]>(
      `SELECT message_id, express_message
       FROM messages
       WHERE conversation_id = ?
         AND sender_id = ?
         AND receiver_id = ?
         AND message_type = 'express'
       ORDER BY created_at DESC, message_id DESC`,
      [conversation_id, userId, receiver_id]
    );

    const hasResponse = existingResponseRows.some((row) => {
      const parsed = safeParse(row.express_message);
      return (
        parsed?.kind === 'final_agreement_response' &&
        Number(parsed?.agreement_message_id) === agreement_message_id
      );
    });

    if (hasResponse) {
      await connection.rollback();
      return res.status(409).json({ error: 'Final agreement already responded.' });
    }

    const express_message = JSON.stringify({
      kind: 'final_agreement_response',
      agreement_message_id,
      decision,
      decided_at: new Date().toISOString(),
    });

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
      decision,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    logger.error('respondFinalAgreement failed', { error, userId, conversation_id, receiver_id });
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
}
