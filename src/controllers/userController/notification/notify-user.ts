import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';

type NotificationType =
  | 'message'
  | 'job_application'
  | 'job_post_status'
  | 'account_verification'
  | 'report'
  | 'system';

export async function notifyUser(
  user_id: number, // Who receives the notification
  title: string, // Notification title
  message: string, // Notification message
  type: NotificationType, // Type of notification
  notifier_id: number | null = null // Who triggered the notification
) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute(
      `INSERT INTO notifications (user_id, notifier_id, title, message, type) VALUES (?, ?, ?, ?, ?)`,
      [user_id, notifier_id, title, message, type]
    );
  } catch (error: any) {
    logger.error('Failed to create notification', { user_id, notifier_id, error });
  } finally {
    if (connection) connection.release();
  }
}
