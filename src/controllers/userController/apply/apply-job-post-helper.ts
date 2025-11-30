import type { PoolConnection } from 'mysql2/promise';

interface JobApplicationParams {
  job_post_id?: number;
  individual_job_post_id?: number;
  team_job_post_id?: number;
  table_name: 'job_post' | 'individual_job_post' | 'team_job_post';
  applicant_id: number;
}

export async function insertJobApplication(
  connection: PoolConnection,
  params: JobApplicationParams
): Promise<void> {
  const { job_post_id, individual_job_post_id, team_job_post_id, table_name, applicant_id } = params;

  // Make sure exactly one job post ID is provided
  const ids = [job_post_id, individual_job_post_id, team_job_post_id].filter(Boolean);
  if (ids.length !== 1) {
    throw new Error('Exactly one job post ID must be provided.');
  }

  try {
    if (job_post_id && table_name === 'job_post') {
      await connection.execute(
        'INSERT INTO job_applications (job_post_id, applicant_id, applied_at) VALUES (?, ?, NOW())',
        [job_post_id, applicant_id]
      );
    } else if (individual_job_post_id && table_name === 'individual_job_post') {
      await connection.execute(
        'INSERT INTO job_applications (individual_job_post_id, applicant_id, applied_at) VALUES (?, ?, NOW())',
        [individual_job_post_id, applicant_id]
      );
    } else if (team_job_post_id && table_name === 'team_job_post') {
      await connection.execute(
        'INSERT INTO job_applications (team_job_post_id, applicant_id, applied_at) VALUES (?, ?, NOW())',
        [team_job_post_id, applicant_id]
      );
    }
  } catch (error) {
    throw error;
  }
}