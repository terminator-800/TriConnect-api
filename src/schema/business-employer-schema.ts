import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createBusinessEmployerTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS business_employer (
      business_employer_id INT PRIMARY KEY,
      business_name VARCHAR(100),
      business_address VARCHAR(255),
      industry VARCHAR(100),
      business_size VARCHAR(50),
      authorized_person VARCHAR(100),
      authorized_person_id VARCHAR(255),
      business_permit_BIR VARCHAR(255),
      DTI VARCHAR(255),
      business_establishment VARCHAR(255),
      FOREIGN KEY (business_employer_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}
