import type { Pool, PoolConnection } from 'mysql2/promise';

export async function createHiresTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS hires (
        hire_id INT AUTO_INCREMENT PRIMARY KEY,
        employer_id INT NOT NULL,
        employee_id INT NOT NULL,
        job_title VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status ENUM('pending', 'accepted', 'rejected', 'active', 'completed', 'terminated') DEFAULT 'pending',
        message_id INT NULL,
        conversation_id INT NULL,
        rejection_reason TEXT NULL,
        accepted_at DATETIME NULL,
        rejected_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (employer_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (employee_id) REFERENCES users(user_id) ON DELETE CASCADE,
        FOREIGN KEY (message_id) REFERENCES messages(message_id) ON DELETE SET NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id) ON DELETE SET NULL,
        
        INDEX idx_employer_id (employer_id),
        INDEX idx_employee_id (employee_id),
        INDEX idx_status (status)
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}
