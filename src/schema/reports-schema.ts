import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createReportsTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS reports (
      report_id INT AUTO_INCREMENT PRIMARY KEY,
      reported_by INT NOT NULL,
      reported_user_id INT NOT NULL,
      reason TEXT NOT NULL,
      message TEXT,
      conversation_id INT, -- nullable: if report is about a chat
      job_post_id INT,     -- nullable: if report is about a job post
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',

      -- 🔐 Prevent duplicate reports from the same user
      UNIQUE (reported_by, reported_user_id),

      FOREIGN KEY (reported_by) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (reported_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL,
      FOREIGN KEY (job_post_id) REFERENCES job_post(job_post_id) ON DELETE SET NULL,

      INDEX idx_reported_by (reported_by),
      INDEX idx_reported_user_id (reported_user_id),
      INDEX idx_conversation_id (conversation_id),
      INDEX idx_job_post_id (job_post_id)
    );
  `;

  try {
    await connection.execute(query);
  } catch (error) {
    throw error; 
  }
}

