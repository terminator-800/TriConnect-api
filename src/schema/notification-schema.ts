import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createNotificationTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS notifications (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,

        -- Who receives the notification
        user_id INT NOT NULL,

        -- Who triggered the notification
        notifier_id  INT NULL,

        -- Notification category
        type ENUM(
            'message',
            'job_application',
            'job_post_status',
            'account_verification',
            'report',
            'system',
            'hire'
        ) NOT NULL,

        -- Title + content
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,

        -- Optional reference to other tables
        reference_id INT NULL,
        reference_type ENUM(
            'conversation',
            'message',
            'job_post',
            'job_application',
            'report',
            'user'
        ) NULL,

        -- Read status
        is_read BOOLEAN DEFAULT FALSE,

        -- Timestamp
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        -- Foreign key
        FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (notifier_id) REFERENCES users(user_id) ON DELETE SET NULL,

        -- Indexes for performance
        INDEX idx_user_id (user_id),
        INDEX idx_reference_id (reference_id)
        );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}
