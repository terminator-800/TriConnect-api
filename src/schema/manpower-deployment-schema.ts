import type { Pool, PoolConnection } from 'mysql2/promise';

export async function createManpowerDeploymentTables(connection: Pool | PoolConnection) {
  const deployment = `
    CREATE TABLE IF NOT EXISTS manpower_deployment (
      deployment_id INT AUTO_INCREMENT PRIMARY KEY,
      manpower_provider_id INT NOT NULL,
      project_name VARCHAR(255) NOT NULL,
      employer_name VARCHAR(255) NOT NULL,
      location VARCHAR(255),
      start_date DATE NULL,
      end_date DATE NULL,
      site_contact VARCHAR(255) NULL,
      total_employer_monthly INT NOT NULL,
      total_platform_fee INT NOT NULL,
      payment_method ENUM('gcash', 'bank_transfer') NOT NULL,
      payment_reference VARCHAR(120) NULL,
      proof_file_path VARCHAR(512) NOT NULL,
      proof_original_name VARCHAR(255) NOT NULL,
      verification_status ENUM('pending_verification', 'verified', 'rejected') NOT NULL DEFAULT 'pending_verification',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (manpower_provider_id) REFERENCES users(user_id) ON DELETE CASCADE,
      INDEX idx_manpower_deployment_provider (manpower_provider_id),
      INDEX idx_manpower_deployment_status (verification_status)
    );
  `;

  const deploymentMember = `
    CREATE TABLE IF NOT EXISTS manpower_deployment_member (
      deployment_member_id INT AUTO_INCREMENT PRIMARY KEY,
      deployment_id INT NOT NULL,
      team_member_id INT NOT NULL,
      worker_rate INT NOT NULL,
      platform_fee INT NOT NULL,
      FOREIGN KEY (deployment_id) REFERENCES manpower_deployment(deployment_id) ON DELETE CASCADE,
      FOREIGN KEY (team_member_id) REFERENCES manpower_team_member(team_member_id) ON DELETE CASCADE,
      UNIQUE KEY uk_deployment_team_member (deployment_id, team_member_id),
      INDEX idx_deployment_member_team (team_member_id)
    );
  `;

  try {
    await connection.execute(deployment);
    await connection.execute(deploymentMember);
  } catch (error) {
    throw error;
  }
}
