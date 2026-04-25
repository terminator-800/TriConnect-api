import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createManpowerTeamMemberTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS manpower_team_member (
      team_member_id INT AUTO_INCREMENT PRIMARY KEY,
      manpower_provider_id INT NOT NULL,
      full_name VARCHAR(150) NOT NULL,
      job_title VARCHAR(150),
      email VARCHAR(255),
      location VARCHAR(255),
      years_experience INT NOT NULL,
      status ENUM('available', 'pending', 'deploy', 'completed') NOT NULL DEFAULT 'available',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manpower_provider_id) REFERENCES users(user_id) ON DELETE CASCADE,
      INDEX idx_manpower_team_member_provider (manpower_provider_id)
    );
  `;

  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}

/** Existing databases created before \`pending\` was added need an ALTER. Safe to run on every startup. */
export async function ensureManpowerTeamMemberPendingStatusEnum(connection: Pool | PoolConnection) {
  try {
    await connection.execute(`
      ALTER TABLE manpower_team_member
      MODIFY COLUMN status ENUM('available', 'pending', 'deploy', 'completed') NOT NULL DEFAULT 'available'
    `);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn('ensureManpowerTeamMemberPendingStatusEnum skipped or failed', { message: msg });
  }
}
