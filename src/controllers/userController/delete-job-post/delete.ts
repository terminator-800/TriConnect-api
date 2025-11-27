import { addMonths } from 'date-fns';
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

export const deleteJobPost = async (
  connection: PoolConnection,
  jobPostId: number
): Promise<void> => {
  const expiresAt = addMonths(new Date(), 1);

  // 1. Main job_post table
  await connection.query<ResultSetHeader>(
    `
      UPDATE job_post
      SET jobpost_status = 'deleted', expires_at = ?
      WHERE job_post_id = ?
    `,
    [expiresAt, jobPostId]
  );

  // 2. Individual job post table
  await connection.query<ResultSetHeader>(
    `
      UPDATE individual_job_post
      SET jobpost_status = 'deleted', expires_at = ?
      WHERE individual_job_post_id = ?
    `,
    [expiresAt, jobPostId]
  );

  // 3. Team job post table
  await connection.query<ResultSetHeader>(
    `
      UPDATE team_job_post
      SET jobpost_status = 'deleted', expires_at = ?
      WHERE team_job_post_id = ?
    `,
    [expiresAt, jobPostId]
  );
};
