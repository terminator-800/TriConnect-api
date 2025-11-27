import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createUsersTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS users (
      user_id INT AUTO_INCREMENT PRIMARY KEY,
      role ENUM('jobseeker', 'business-employer', 'individual-employer', 'manpower-provider', 'administrator') NOT NULL,
      is_registered BOOLEAN DEFAULT FALSE,
      is_verified BOOLEAN DEFAULT FALSE,
      is_submitted BOOLEAN DEFAULT FALSE,
      is_rejected BOOLEAN DEFAULT FALSE,
      verified_at DATETIME NULL DEFAULT NULL,
      is_subscribed BOOLEAN DEFAULT FALSE,
      subscription_start DATE DEFAULT NULL, 
      subscription_end DATE DEFAULT NULL,  
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      profile VARCHAR(255), 

      -- Token to manage single active session
      current_token VARCHAR(255) DEFAULT NULL,

      -- Account status fields
      account_status ENUM('active', 'restricted', 'blocked', 'suspended', 'banned') DEFAULT 'active',
      status_reason TEXT,
      status_updated_at DATETIME DEFAULT NULL,

      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}
