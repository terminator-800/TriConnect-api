import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createFeedbackTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS feedback (
      feedback_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error; 
  }
}

