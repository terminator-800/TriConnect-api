import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

export interface JobPost extends RowDataPacket {
  id: number;
  post_type: 'job_post' | 'individual_job_post' | 'team_job_post';
  jobpost_status: string;
  job_title?: string; // only for job_post
  job_description?: string; // only for job_post
  created_at: Date;
  expires_at?: Date;
}

export const getJobPostById = async (
  connection: PoolConnection,
  jobPostId: number
): Promise<JobPost | null> => {
  try {
    const [rows] = await connection.query<JobPost[]>(
      `
      (
        SELECT 
          job_post_id AS id,
          'job_post' AS post_type,
          jobpost_status,
          job_title,
          job_description,
          created_at,
          expires_at
        FROM job_post
        WHERE job_post_id = ?
      )
      UNION ALL
      (
        SELECT 
          individual_job_post_id AS id,
          'individual_job_post' AS post_type,
          jobpost_status,
          NULL AS job_title,
          qualifications AS job_description,
          created_at,
          expires_at
        FROM individual_job_post
        WHERE individual_job_post_id = ?
      )
      UNION ALL
      (
        SELECT 
          team_job_post_id AS id,
          'team_job_post' AS post_type,
          jobpost_status,
          NULL AS job_title,
          team_skills AS job_description,
          created_at,
          expires_at
        FROM team_job_post
        WHERE team_job_post_id = ?
      )
      LIMIT 1;
    `,
      [jobPostId, jobPostId, jobPostId]
    );

    return rows[0] || null;
  } catch (error) {
    throw new Error('Failed to retrieve job post.');
  }
};
