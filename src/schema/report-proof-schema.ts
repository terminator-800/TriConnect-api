import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createReportProofsTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS report_proofs (
      proof_id INT AUTO_INCREMENT PRIMARY KEY,
      report_id INT NOT NULL,
      file_url VARCHAR(255) NOT NULL,
      file_type ENUM('image', 'file') DEFAULT 'image',
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      -- 🔗 Foreign key linking to the reports table
      FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE,

      -- 📦 Index for quick lookup by report
      INDEX idx_report_id (report_id)
    );
  `;
  
  try {
    await connection.execute(query);
  } catch (error) {
    throw error; 
  }
}

