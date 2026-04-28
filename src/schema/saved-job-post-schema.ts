import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createSavedJobPostsTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS saved_job_posts (
      saved_job_id INT AUTO_INCREMENT PRIMARY KEY,
      jobseeker_id INT NOT NULL,
      job_post_id INT NOT NULL,
      saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobseeker_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (job_post_id) REFERENCES job_post(job_post_id) ON DELETE CASCADE,
      UNIQUE KEY uniq_jobseeker_jobpost (jobseeker_id, job_post_id),
      INDEX idx_saved_jobseeker_id (jobseeker_id),
      INDEX idx_saved_job_post_id (job_post_id)
    );
  `;

  try {
    await connection.execute(query);
  } catch (error) {
    logger.error('Failed to create saved_job_posts table', { error });
    throw error;
  }
}
