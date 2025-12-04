import type { Request, Response } from 'express';
import pool from '../../config/database-connection.js';
import type { RowDataPacket } from 'mysql2';

interface EnrolledEmployer extends RowDataPacket {
  name: string;
  type: string;
  active_jobs: number;
}

export const getEnrolledEmployers = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        CASE 
          WHEN u.role = 'business-employer' THEN be.business_name
          WHEN u.role = 'individual-employer' THEN ie.full_name
          WHEN u.role = 'manpower-provider' THEN mp.agency_name
        END AS name,
        CASE 
          WHEN u.role = 'business-employer' THEN 'Business Employer'
          WHEN u.role = 'individual-employer' THEN 'Individual Employer'
          WHEN u.role = 'manpower-provider' THEN 'Manpower Agency'
        END AS type,
        COALESCE(job_count.active_jobs, 0) AS active_jobs
      FROM users u
      LEFT JOIN business_employer be ON u.user_id = be.business_employer_id
      LEFT JOIN individual_employer ie ON u.user_id = ie.individual_employer_id
      LEFT JOIN manpower_provider mp ON u.user_id = mp.manpower_provider_id
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) AS active_jobs
        FROM (
          SELECT user_id FROM job_post WHERE jobpost_status = 'active'
          UNION ALL
          SELECT user_id FROM individual_job_post WHERE jobpost_status = 'active'
          UNION ALL
          SELECT user_id FROM team_job_post WHERE jobpost_status = 'active'
        ) AS all_jobs
        GROUP BY user_id
      ) job_count ON u.user_id = job_count.user_id
      WHERE u.role IN ('business-employer', 'individual-employer', 'manpower-provider')
        AND u.is_verified = TRUE
      ORDER BY active_jobs DESC, name ASC
      LIMIT 50
    `;

    const [rows] = await pool.query<EnrolledEmployer[]>(query);

    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching enrolled employers:', error);
    res.status(500).json({ 
      message: 'Failed to fetch enrolled employers',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};