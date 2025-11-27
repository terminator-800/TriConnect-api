import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import type { Request, Response } from "express";
import type { AuthenticatedUser } from "../../../types/express/auth.js";
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";
import { ROLE } from "../../../utils/roles.js";

// Make params optional
interface RejectApplicationParams {
  applicationId?: string;
}

// Request type with optional authenticated user
type RejectApplicationRequest = Request<
  RejectApplicationParams,
  any,
  any,
  any
> & {
  user?: AuthenticatedUser;
};

const allowedRoles: typeof ROLE[keyof typeof ROLE][] = [
  ROLE.BUSINESS_EMPLOYER,
  ROLE.INDIVIDUAL_EMPLOYER,
  ROLE.MANPOWER_PROVIDER
];

export const rejectApplication = async (
  req: RejectApplicationRequest,
  res: Response
): Promise<Response> => {
  let connection: PoolConnection | undefined;
  const ip = req.ip;
  const role = req.user?.role;

  if (!allowedRoles.includes(role as typeof ROLE[keyof typeof ROLE])) {
    logger.warn("Unauthorized role tried to rejecting an application", { ip, role });
    return res.status(403).json({ error: "Forbidden: Only authorized users can reject an applications." });
  }

  try {
    const employerUserId = req.user?.user_id;
    const applicationId = req.params.applicationId
      ? parseInt(req.params.applicationId, 10)
      : NaN;

    if (!employerUserId) {
      logger.warn("Unauthorized attempt to reject application", { ip });
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!Number.isFinite(applicationId)) {
      logger.warn("Invalid application ID in rejectApplication", { employerUserId, applicationId, ip });
      return res.status(400).json({ message: "Invalid application ID" });
    }

    connection = await pool.getConnection();

    const [result] = await connection.query<ResultSetHeader>(
      `
      UPDATE job_applications ja
      JOIN job_post jp ON jp.job_post_id = ja.job_post_id
      SET ja.application_status = 'rejected'
      WHERE ja.application_id = ? AND jp.user_id = ?
      `,
      [applicationId, employerUserId]
    );

    if (result.affectedRows === 0) {
      logger.warn("Application not found or not owned by employer", { employerUserId, applicationId, ip });
      return res
        .status(404)
        .json({ message: "Application not found or not owned by employer" });
    }

    return res.status(200).json({ message: "Application rejected successfully" });
  } catch (error: any) {
    logger.error("Failed to reject application", {
      ip,
      name: error?.name || "UnknownError",
      message: error?.message || "Unknown error during application rejection",
      stack: error?.stack || "No stack trace",
      cause: error?.cause || "No cause",
      error,
    });
    return res.status(500).json({ message: "Failed to reject application" });
  } finally {
    if (connection) connection.release();
  }
};
