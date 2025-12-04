import type { Request, Response } from 'express';
import pool from '../../../config/database-connection.js';
import type { RowDataPacket } from 'mysql2';
import { format } from 'date-fns';

interface SuccessfulHire extends RowDataPacket {
  name: string;
  company: string;
  position: string;
  accepted_at: Date;
}

export const getSuccessfulHires = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        js.full_name AS name,
        CASE 
          WHEN u_employer.role = 'business-employer' THEN be.business_name
          WHEN u_employer.role = 'individual-employer' THEN ie.full_name
          WHEN u_employer.role = 'manpower-provider' THEN mp.agency_name
          ELSE 'Unknown'
        END AS company,
        h.job_title AS position,
        h.accepted_at
      FROM hires h
      INNER JOIN users u_employee ON h.employee_id = u_employee.user_id
      INNER JOIN jobseeker js ON u_employee.user_id = js.jobseeker_id
      INNER JOIN users u_employer ON h.employer_id = u_employer.user_id
      LEFT JOIN business_employer be ON u_employer.user_id = be.business_employer_id
      LEFT JOIN individual_employer ie ON u_employer.user_id = ie.individual_employer_id
      LEFT JOIN manpower_provider mp ON u_employer.user_id = mp.manpower_provider_id
      WHERE h.status IN ('accepted', 'active', 'completed')
      ORDER BY h.accepted_at DESC
      LIMIT 20
    `;

    const [rows] = await pool.query<SuccessfulHire[]>(query);

    // Format dates using date-fns
    const formattedRows = rows.map(row => ({
      ...row,
      date: format(new Date(row.accepted_at), 'yyyy-MM-dd')
    }));

    res.status(200).json(formattedRows);
  } catch (error) {
    console.error('Error fetching successful hires:', error);
    res.status(500).json({ 
      message: 'Failed to fetch successful hires',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};