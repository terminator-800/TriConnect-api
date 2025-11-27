import { getApplicantsByEmployer } from "../../../service/get-applicants-by-employer-service.js";
import type { Request, Response } from "express";
import type { AuthenticatedUser } from "../../../types/express/auth.js";
import type { PoolConnection } from "mysql2/promise";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";

type ApplicantsRequest = Request<{}, any, {}, { page?: string; pageSize?: string }> & {
  user?: AuthenticatedUser;
};

const allowedRoles: typeof ROLE[keyof typeof ROLE][] = [
  ROLE.BUSINESS_EMPLOYER,
  ROLE.INDIVIDUAL_EMPLOYER,
  ROLE.MANPOWER_PROVIDER,
];

export const viewApplicants = async (req: ApplicantsRequest, res: Response): Promise<Response> => {
  let connection: PoolConnection | undefined;
  const ip = req.ip;
  const role = req.user?.role;
  const user_id = req.user?.user_id;

  try {
    const employerUserId = req.user?.user_id;

    if (!user_id) {
      logger.warn("Unauthorized access attempt to view applicants", { ip });
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(role)) {
      logger.warn("Unauthorized role tried to submit a feedback", { ip, role, user_id });
      return res.status(403).json({ error: "Forbidden: Only authorized users can submit a feedback." });
    }

    if (!employerUserId) {
      logger.warn("Unauthorized access attempt to view applicants", { ip });
      return res.status(401).json({ message: "Unauthorized" });
    }

    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize, 10) : 10;

    connection = await pool.getConnection();

    if (!connection) {
      logger.error("Failed to obtain DB connection", { ip });
      return res.status(500).json({ message: "Internal server error" });
    }


    const result = await getApplicantsByEmployer(connection, employerUserId, { page, pageSize });

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error("Unexpected error in viewApplicants", {
      ip,
      name: error?.name || "UnknownError",
      message: error?.message || "Unknown error",
      stack: error?.stack || "No stack trace",
      cause: error?.cause || "No cause",
      error,
    });
    return res.status(500).json({ message: "Failed to fetch applicants" });
  } finally {
      if (connection) connection.release();
  }
};
