import { getMessageHistoryByConversationId } from '../../messageController/history/get-message-history.js';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../../../types/express/auth.js';
import type { PoolConnection } from 'mysql2/promise';
import logger from '../../../../config/logger.js';
import pool from '../../../../config/database-connection.js';

export const messageHistory = async (req: Request, res: Response): Promise<void> => {
  let connection: PoolConnection | undefined;
  const ip = req.ip;
  const user_id = (req.user as AuthenticatedUser)?.user_id;

  try {
    const conversation_id = req.params.conversation_id;

    if (!conversation_id) {
      logger.warn("Missing conversation_id parameter", { user_id, ip });
      res.status(400).json({ error: 'conversation_id is required' });
      return;
    }

    connection = await pool.getConnection();

    const messages = await getMessageHistoryByConversationId(connection, conversation_id);

    res.json(messages);
  } catch (error: any) {
    logger.error("Unexpected error in messageHistory handler", {
      error,
      name: error?.name || "UnknownError",
      message: error?.message || "No message",
      stack: error?.stack || "No stack trace",
      cause: error?.cause || "No cause",
      ip
    });
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    if (connection) connection.release();
  }
};
