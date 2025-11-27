import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createJobApplicationsTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS job_applications (
      application_id INT AUTO_INCREMENT PRIMARY KEY,
      job_post_id INT NOT NULL, -- Foreign key to the job post
      applicant_id INT NOT NULL, -- Foreign key to the user applying
      application_status ENUM('pending', 'reviewed', 'accepted', 'rejected') DEFAULT 'pending',
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (job_post_id) REFERENCES job_post(job_post_id) ON DELETE CASCADE,
      FOREIGN KEY (applicant_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error; 
  }
}

