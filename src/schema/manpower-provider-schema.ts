import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createManpowerProviderTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS manpower_provider (
      manpower_provider_id INT PRIMARY KEY,
      agency_name VARCHAR(100),
      agency_address VARCHAR(255),
      agency_services TEXT,
      agency_authorized_person VARCHAR(100),
      dole_registration_number VARCHAR(255),
      mayors_permit VARCHAR(255),
      agency_certificate VARCHAR(255),
      authorized_person_id VARCHAR(255),
      FOREIGN KEY (manpower_provider_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `;

   try {
    await connection.execute(query);
  } catch (error) {
    throw error; 
  }
}
