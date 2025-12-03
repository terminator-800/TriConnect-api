import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { format } from 'date-fns';
import { ROLE } from '../../../utils/roles.js';
import logger from '../../../config/logger.js';

export interface JobseekerProfile {
  user_id: number;
  full_name: string;
  email: string;
  gender: string;
  phone: string;
  date_of_birth: string;
  is_verified: boolean | number;
  is_submitted: boolean | number;
  is_rejected: boolean | number;
  account_status: string;
  role: typeof ROLE.JOBSEEKER;
  profile?: string | null;
  // Employment fields for disabled account
  employment_status: 'available' | 'hired' | 'member';
  employer_id?: number | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  employer_name?: string | null;
  job_title?: string | null;
}

export async function getJobseekerProfile(
  connection: PoolConnection,
  user_id: number
): Promise<JobseekerProfile | null> {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `
      SELECT 
        j.jobseeker_id AS user_id,
        j.full_name,
        u.email,
        j.gender,
        j.phone,
        j.date_of_birth,
        u.is_verified,
        u.is_submitted,
        u.is_rejected,
        u.account_status,
        u.profile,
        u.employment_status,
        u.employer_id,
        u.employed_start_date,
        u.employed_end_date,
        -- Get employer details if hired
        CASE 
          WHEN u.employment_status = 'hired' THEN (
            SELECT COALESCE(
              be.business_name,
              ie.full_name,
              mp.agency_name
            )
            FROM users employer
            LEFT JOIN business_employer be ON employer.user_id = be.business_employer_id
            LEFT JOIN individual_employer ie ON employer.user_id = ie.individual_employer_id
            LEFT JOIN manpower_provider mp ON employer.user_id = mp.manpower_provider_id
            WHERE employer.user_id = u.employer_id
          )
          ELSE NULL
        END AS employer_name,
        -- Get job title from the hire record
        CASE 
          WHEN u.employment_status = 'hired' THEN (
            SELECT job_title 
            FROM hires 
            WHERE employee_id = u.user_id 
            AND status = 'active'
            LIMIT 1
          )
          ELSE NULL
        END AS job_title
      FROM jobseeker j
      JOIN users u ON j.jobseeker_id = u.user_id
      WHERE j.jobseeker_id = ?
      `,
      [user_id]
    );

    const row = rows[0];
    if (!row) return null;

    const profile: JobseekerProfile = {
      user_id: row.user_id,
      full_name: row.full_name,
      email: row.email,
      gender: row.gender,
      phone: row.phone,
      date_of_birth: row.date_of_birth
        ? format(new Date(row.date_of_birth), "MMMM dd, yyyy 'at' hh:mm a")
        : '',
      is_verified: row.is_verified,
      is_submitted: row.is_submitted,
      is_rejected: row.is_rejected,
      account_status: row.account_status,
      role: ROLE.JOBSEEKER,
      profile: row.profile || null,
      // Employment fields
      employment_status: row.employment_status || 'available',
      employer_id: row.employer_id || null,
      contract_start_date: row.employed_start_date 
        ? format(new Date(row.employed_start_date), 'MMMM dd, yyyy')
        : null,
      contract_end_date: row.employed_end_date
        ? format(new Date(row.employed_end_date), 'MMMM dd, yyyy')
        : null,
      employer_name: row.employer_name || null,
      job_title: row.job_title || null,
    };

    return profile;
  } catch (error) {
    throw error;
  }
}