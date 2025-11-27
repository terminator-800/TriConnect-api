import type { PoolConnection } from 'mysql2/promise';

export async function insertJobApplication(
  connection: PoolConnection,
  job_post_id: number,
  applicant_id: number
): Promise<void> {
  try {
    console.log('Inserting job application:', { job_post_id, applicant_id });
    await connection.execute(
      `INSERT INTO job_applications (job_post_id, applicant_id, applied_at)
       VALUES (?, ?, NOW())`,
      [job_post_id, applicant_id]
    );
  } catch (error) {
    throw error;
  }
}
