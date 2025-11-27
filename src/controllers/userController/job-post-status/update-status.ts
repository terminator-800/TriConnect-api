import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';

/**
 * Update the status of ANY job post type
 */
export const updateStatus = async (
  connection: PoolConnection,
  status: string,
  jobPostId: number
): Promise<number> => {
  const queries = [
    {
      sql: 'UPDATE job_post SET jobpost_status = ? WHERE job_post_id = ?',
      values: [status, jobPostId],
    },
    {
      sql: 'UPDATE individual_job_post SET jobpost_status = ? WHERE individual_job_post_id = ?',
      values: [status, jobPostId],
    },
    {
      sql: 'UPDATE team_job_post SET jobpost_status = ? WHERE team_job_post_id = ?',
      values: [status, jobPostId],
    },
  ];

  let totalAffectedRows = 0;

  for (const q of queries) {
    const [result] = await connection.query<ResultSetHeader>(q.sql, q.values);
    totalAffectedRows += result.affectedRows;
  }

  return totalAffectedRows; // aggregated result
};
