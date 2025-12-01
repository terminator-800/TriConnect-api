import type { CustomRequest } from '../../../types/express/auth.js';
import type { Response } from 'express';
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';

export const markNotificationSeen = async (req: CustomRequest, res: Response) => {
  let connection: PoolConnection | undefined;
  try {
    const user_id = req.user?.user_id;
    if (!user_id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { notification_id } = req.params;
    if (!notification_id) {
      return res.status(400).json({ message: 'Notification ID is required' });
    }

    connection = await pool.getConnection();

    // Update the notification's is_read status to true
    // Only allow updating notifications that belong to the authenticated user
    const [result] = await connection.execute<ResultSetHeader>(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE notification_id = ? AND user_id = ?
      `,
      [notification_id, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Notification not found or not authorized' });
    }

    return res.status(200).json({ message: 'Notification marked as seen', success: true });
  } catch (error: any) {
    logger.error('Error in markNotificationSeen controller', {
      ip: req.ip,
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      error,
    });
    return res.status(500).json({ message: 'Failed to mark notification as seen.' });
  } finally {
    if (connection) connection.release();
  }
};
