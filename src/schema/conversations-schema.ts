import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createConversationsTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS conversations (
      conversation_id INT AUTO_INCREMENT PRIMARY KEY,
      user1_id INT NOT NULL,
      user2_id INT NOT NULL,
      user_small_id INT NOT NULL,
      user_large_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_pair (user_small_id, user_large_id)
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}

