import type { PoolConnection } from "mysql2/promise";

export async function insertJobApplication(
  connection: PoolConnection,
  job_post_id: number,
  applicant_id: number,
  role: string
): Promise<void> {
 try {
    await connection.execute(
      `INSERT INTO job_applications (job_post_id, applicant_id, role, applied_at)
       VALUES (?, ?, ?, NOW())`,
      [job_post_id, applicant_id, role]
    );
  } catch (error) {
    throw error;
  }
}





