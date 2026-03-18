import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { format } from 'date-fns';

export type UserRole =
  | 'jobseeker'
  | 'individual-employer'
  | 'business-employer'
  | 'manpower-provider';
export type JobCategory = 'pending' | 'active' | 'completed' | 'rejected';

export interface UserStatus {
  is_verified: boolean;
  is_rejected: boolean;
  is_submitted: boolean;
}

export interface JobPostRow extends RowDataPacket {
  post_type: 'job_post';
  post_id: number;
  job_title: string | null;
  job_description: string | null;
  location: string | null;
  salary_range: string | null;
  status: string | null;
  jobpost_status: string | null;
  created_at: string | Date | null;
  role: UserRole;
  employer_name: string | null;
  authorized_person: string | null;
  applicant_count: number;
  required_skill: string | null;
  category: JobCategory | null;
  job_type: string | null;
  number_of_workers: number | null;
}

export interface GroupedJobPosts {
  pending: JobPostRow[];
  active: JobPostRow[];
  completed: JobPostRow[];
  rejected: JobPostRow[];
}

export interface JobPostsByUser extends UserStatus, GroupedJobPosts {}

export async function getJobPostsByUserGrouped(
  connection: PoolConnection,
  user_id: number
): Promise<JobPostsByUser> {
  try {
    // Fetch user verification status
    const [[userStatus]] = await connection.query<RowDataPacket[] & UserStatus[]>(
      `SELECT is_verified, is_rejected, is_submitted FROM users WHERE user_id = ?`,
      [user_id]
    );

    if (!userStatus) throw new Error(`User status not found for user_id ${user_id}`);

    // Fetch user role to determine if we should include number_of_workers
    const [[userRole]] = await connection.query<RowDataPacket[]>(
      `SELECT role FROM users WHERE user_id = ?`,
      [user_id]
    );

    const role = userRole?.role as UserRole;

    // Fetch only standard job posts
    const [rows] = await connection.query<RowDataPacket[] & JobPostRow[]>(
      `
      SELECT 
        'job_post' AS post_type,
        jp.job_post_id AS post_id,
        jp.job_title,
        jp.job_description,
        jp.location,
        jp.salary_range,
        jp.status,
        jp.jobpost_status,
        jp.created_at,
        u.role,
        CASE 
          WHEN u.role = 'business-employer' THEN be.business_name
          WHEN u.role = 'manpower-provider' THEN mp.agency_name
          WHEN u.role = 'individual-employer' THEN ie.full_name
          ELSE NULL
        END AS employer_name,
        CASE 
          WHEN u.role = 'business-employer' THEN be.authorized_person
          WHEN u.role = 'manpower-provider' THEN mp.agency_authorized_person
          WHEN u.role = 'individual-employer' THEN ie.full_name
          ELSE NULL
        END AS authorized_person,
        jp.required_skill,
        COUNT(CASE WHEN ja.application_status != 'rejected' THEN 1 END) AS applicant_count,
        jp.job_type,
        CASE 
          WHEN u.role = 'individual-employer' THEN NULL
          ELSE jp.number_of_worker
        END AS number_of_workers
      FROM job_post jp
      JOIN users u ON jp.user_id = u.user_id
      LEFT JOIN business_employer be ON u.user_id = be.business_employer_id
      LEFT JOIN manpower_provider mp ON u.user_id = mp.manpower_provider_id
      LEFT JOIN individual_employer ie ON u.user_id = ie.individual_employer_id
      LEFT JOIN job_applications ja ON jp.job_post_id = ja.job_post_id
      WHERE jp.user_id = ? AND (jp.jobpost_status != 'deleted' OR jp.jobpost_status IS NULL)
      GROUP BY jp.job_post_id
      ORDER BY jp.created_at DESC
      `,
      [user_id]
    );

    const grouped: GroupedJobPosts = { pending: [], active: [], completed: [], rejected: [] };

    for (const row of rows) {
      if (row.created_at)
        row.created_at = format(new Date(row.created_at), "MMMM d, yyyy 'at' h:mm a");

      if (row.status === 'rejected') grouped.rejected.push(row);
      else if (row.jobpost_status === 'pending') grouped.pending.push(row);
      else if (['active', 'paused'].includes(row.jobpost_status || '')) grouped.active.push(row);
      else if (row.jobpost_status === 'completed') grouped.completed.push(row);
    }

    return {
      is_verified: !!userStatus?.is_verified,
      is_rejected: !!userStatus?.is_rejected,
      is_submitted: !!userStatus?.is_submitted,
      ...grouped,
    };
  } catch (error) {
    throw error;
  }
}