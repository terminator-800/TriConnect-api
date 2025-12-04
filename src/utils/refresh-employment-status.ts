import type { RowDataPacket } from "mysql2";
import pool from "../config/database-connection.js";

interface EmploymentRow extends RowDataPacket {
  employment_status: "available" | "hired" | "member";
  employed_end_date: string | null;
}

export const refreshEmploymentStatus = async (userId: number) => {
  const [rows] = await pool.execute<EmploymentRow[]>(
    `
    SELECT employment_status, employed_end_date
    FROM users
    WHERE user_id = ?
    `,
    [userId]
  );

  const status = rows[0];
  if (!status) return;

  const now = new Date();

  if (
    status.employment_status === "hired" &&
    status.employed_end_date &&
    new Date(status.employed_end_date) < now
  ) {
    await pool.execute(
      `
      UPDATE users 
      SET employment_status = 'available',
          employer_id = NULL,
          employed_start_date = NULL,
          employed_end_date = NULL
      WHERE user_id = ?
      `,
      [userId]
    );
  }
};
