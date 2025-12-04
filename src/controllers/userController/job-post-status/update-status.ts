import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

/**
 * Update the status of ANY job post type
 */

export const updateStatus = async (
  connection: PoolConnection,
  status: string,
  jobPostId: number,
  postType?: 'job_post' | 'individual_job_post' | 'team_job_post'
): Promise<number> => {
  const query = {
    job_post: 'UPDATE job_post SET jobpost_status = ? WHERE job_post_id = ?',
    individual_job_post:
      'UPDATE individual_job_post SET jobpost_status = ? WHERE individual_job_post_id = ?',
    team_job_post: 'UPDATE team_job_post SET jobpost_status = ? WHERE team_job_post_id = ?',
  };

  const [result] = await connection.query<ResultSetHeader>(query[postType!], [status, jobPostId]);

  return result.affectedRows;
};
