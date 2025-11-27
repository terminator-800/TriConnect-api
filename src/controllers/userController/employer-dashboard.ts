import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getApplicantsByEmployer } from "../../service/get-applicants-by-employer-service.js";
import type { Request, Response } from "express";
import type { AuthenticatedUser } from "../../types/express/auth.js";
import { format } from "date-fns";
import logger from "../../config/logger.js";
import pool from "../../config/database-connection.js";

// Type for recent job posts query result
interface JobPostRow extends RowDataPacket {
  job_post_id: number;
  job_title: string;
  job_type: string;
  created_at: Date | string | null;
  jobpost_status: string | null;
  applicant_count: number;
}

// Request type with authenticated user
type EmployerDashboardRequest = Request & {
  user?: AuthenticatedUser;
};

export const employerDashboard = async (
  req: EmployerDashboardRequest,
  res: Response
): Promise<Response> => {
  let connection: PoolConnection | undefined;
  const ip = req.ip;
  const user_id = req.user?.user_id;

  try {
    const employerUserId = req.user?.user_id;

    if (!employerUserId) {
      logger.warn("Unauthorized access attempt to dashboard", { ip });
      return res.status(401).json({ message: "Unauthorized" });
    }

    connection = await pool.getConnection();

    if (!connection) {
      logger.error("Failed to obtain DB connection", { ip, user_id });
      return res.status(500).json({ message: "Internal server error" });
    }

    // Recent job posts (top 3 by created_at) with applicant count (excluding rejected)
    const [recentPostsRows] = await connection.query<JobPostRow[]>(
      `
      SELECT 
        jp.job_post_id,
        jp.job_title,
        jp.job_type,
        jp.created_at,
        jp.jobpost_status,
        COUNT(CASE WHEN ja.application_status != 'rejected' THEN 1 END) AS applicant_count
      FROM job_post jp
      LEFT JOIN job_applications ja ON ja.job_post_id = jp.job_post_id
      WHERE jp.user_id = ?
        AND (jp.jobpost_status != 'deleted' OR jp.jobpost_status IS NULL)
      GROUP BY jp.job_post_id
      ORDER BY jp.created_at DESC
      LIMIT 3
      `,
      [employerUserId]
    );

    const recentJobPosts = recentPostsRows.map((row) => ({
      job_post_id: row.job_post_id,
      job_title: row.job_title,
      job_type: row.job_type,
      created_at_formatted: row.created_at
        ? format(new Date(row.created_at), "MMMM d, yyyy")
        : "-",
      applicant_count: Number(row.applicant_count || 0),
      jobpost_status: row.jobpost_status || "pending",
    }));

    // Recent applicants (top 5)
    const { applicants } = await getApplicantsByEmployer(connection, employerUserId, {
      page: 1,
      pageSize: 5,
    });

    return res.status(200).json({ recentJobPosts, recentApplicants: applicants });
  } catch (error: any) {
    logger.error("Failed to load employer dashboard", {
      ip,
      name: error?.name || "UnknownError",
      message: error?.message || "Unknown error",
      stack: error?.stack || "No stack trace",
      cause: error?.cause || "No cause",
      error,
    });
    return res.status(500).json({ message: "Failed to load dashboard" });
  } finally {
      if (connection) connection.release();
  }
};
