import type { CustomRequest } from "../../types/express/auth.js";
import type { RowDataPacket } from "mysql2/promise";
import type { Response } from "express";
import pool from "../../config/database-connection.js";
import logger from "../../config/logger.js";

interface UserFeedback extends RowDataPacket {
  feedback_id: number;
  user_id: number;
  message: string;
  submitted_at: string;
  user_name: string | null;
  profile: string | null;
}

export const usersFeedbacks = async (req: CustomRequest, res: Response) => {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;

  try {
    if (req.user?.role !== "administrator") {
      logger.warn(`User ID ${req.user?.user_id} attempted to fetch feedback without proper authorization.`);
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }

    connection = await pool.getConnection();
    const feedbacks: UserFeedback[] = await getUserFeedbacks(connection);

    return res.status(200).json(feedbacks);
  } catch (error: any) {
    logger.error("Error in usersFeedbacks controller", {
      ip: req.ip,
      message: error?.message || "Unknown error",
      stack: error?.stack || "No stack trace",
      name: error?.name || "UnknownError",
      cause: error?.cause || "No cause",
      error,
    });
    return res.status(500).json({ message: "Failed to fetch user feedback." });
  } finally {
    if (connection) connection.release();
  }
};


async function getUserFeedbacks(connection: Awaited<ReturnType<typeof pool.getConnection>>): Promise<UserFeedback[]> {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(`
      SELECT
          f.feedback_id,
          f.user_id,
          f.message,
          DATE_FORMAT(f.created_at, '%M %e, %Y at %l:%i %p') AS submitted_at,
          COALESCE(
            js.full_name,
            be.business_name,
            ie.full_name,
            mp.agency_name
          ) AS user_name,
          u.profile AS profile
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.user_id
      LEFT JOIN jobseeker js ON f.user_id = js.jobseeker_id
      LEFT JOIN business_employer be ON f.user_id = be.business_employer_id
      LEFT JOIN individual_employer ie ON f.user_id = ie.individual_employer_id
      LEFT JOIN manpower_provider mp ON f.user_id = mp.manpower_provider_id
      ORDER BY f.created_at DESC
    `);

    return rows as UserFeedback[];
  } catch (error: any) {
    throw error;
  }
}

