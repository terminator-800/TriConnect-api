import type { Pool, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger.js';

export async function createJobPostTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS job_post (
      job_post_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, -- Foreign key to reference the user
      status ENUM('pending', 'approved', 'rejected', 'draft') DEFAULT NULL,
      jobpost_status ENUM('pending', 'active', 'paused', 'completed', 'archive', 'deleted') DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      rejection_reason TEXT DEFAULT NULL,
      is_verified_jobpost BOOLEAN DEFAULT FALSE,
      job_title VARCHAR(255) NOT NULL,
      job_type ENUM('Full-time', 'Part-time', 'Contract') NOT NULL,
      salary_range INT,
      location VARCHAR(255),
      required_skill TEXT,
      job_description TEXT,
      applicant_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE 
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}

export async function createIndividualJobPostTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS individual_job_post (
      individual_job_post_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, -- Foreign key to reference the user
      status ENUM('pending', 'approved', 'rejected', 'draft') DEFAULT NULL,
      jobpost_status ENUM('pending', 'active', 'paused', 'completed', 'archive', 'deleted') DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      rejection_reason TEXT DEFAULT NULL,
      is_verified_jobpost BOOLEAN DEFAULT FALSE,
      worker_name VARCHAR(255) DEFAULT NULL,
      worker_category VARCHAR(255) DEFAULT NULL,
      years_of_experience INT DEFAULT NULL,
      location VARCHAR(255) DEFAULT NULL,
      qualifications TEXT DEFAULT NULL,
      skill VARCHAR(255) DEFAULT NULL,
      applicant_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE 
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}

export async function createTeamJobPostTable(connection: Pool | PoolConnection) {
  const query = `
    CREATE TABLE IF NOT EXISTS team_job_post (
      team_job_post_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL, -- Foreign key to reference the user
      status ENUM('pending', 'approved', 'rejected', 'draft') DEFAULT NULL,
      jobpost_status ENUM('pending', 'active', 'paused', 'completed', 'archive', 'deleted') DEFAULT NULL,
      submitted_at DATETIME DEFAULT NULL,
      approved_at DATETIME DEFAULT NULL,
      expires_at DATETIME DEFAULT NULL,
      rejection_reason TEXT DEFAULT NULL,
      is_verified_jobpost BOOLEAN DEFAULT FALSE,
      worker_category VARCHAR(255) DEFAULT NULL,
      number_of_workers INT DEFAULT NULL,
      location VARCHAR(255) DEFAULT NULL,
      senior_workers INT DEFAULT NULL,
      mid_level_workers INT DEFAULT NULL,
      junior_workers INT DEFAULT NULL,
      entry_level_workers INT DEFAULT NULL,
      team_skills TEXT DEFAULT NULL,
      applicant_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE 
    );
  `;
  try {
    await connection.execute(query);
  } catch (error) {
    throw error;
  }
}

