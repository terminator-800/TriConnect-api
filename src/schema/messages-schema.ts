import type { Pool, PoolConnection } from 'mysql2/promise';

export async function createMessagesTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS messages (
      message_id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      read_at DATETIME NULL,
      is_read BOOLEAN DEFAULT FALSE,
      full_name VARCHAR(255) NULL,
      phone_number VARCHAR(50) NULL,
      email_address VARCHAR(255) NULL,
      current_address VARCHAR(255) NULL,
      cover_letter TEXT NULL,
      message_text TEXT NULL,
      job_title VARCHAR(255) NULL,
      resume VARCHAR(255) NULL,
      employer_name VARCHAR(255) NULL,
      company_name VARCHAR(255) NULL,
      project_location VARCHAR(255) NULL,
      start_date DATE NULL,
      project_description TEXT NULL,
      message_type ENUM('text', 'image', 'file', 'apply', 'request') DEFAULT 'text',
      file_url VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE CASCADE,
      INDEX idx_conversation_id (conversation_id),
      INDEX idx_receiver_id (receiver_id)
    );
  `;

  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}
