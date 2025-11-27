import dotenv from 'dotenv';
dotenv.config();
import type { Request, Response } from 'express';
import type { PoolConnection } from "mysql2/promise";
import { findUsersEmail } from "../../../service/find-user-email-service.js";
import { markRegistered } from "../../userController/email-verification/mark-registered-service.js";
import { ROLE } from '../../../utils/roles.js'
import type { User } from '../../../interface/interface.js';
import jwt from "jsonwebtoken";
import logger from '../../../config/logger.js';
import pool from "../../../config/database-connection.js";

interface JwtPayload {
  email: string;
  role: keyof typeof ROLE;
}

export const verifyEmail = async (request: Request<{}, {}, {}, { token?: string }>, response: Response) => {
  let connection: PoolConnection | undefined;
  const { token } = request.query;

  if (!token || Array.isArray(token)) {
    logger.warn("Missing or invalid token in verifyEmail request", { token });
    return response.status(400).send("Missing or invalid token.");
  }

  if (!process.env.JWT_SECRET) {
    logger.error("JWT_SECRET not configured in environment variables");
    return response.status(500).json({ message: "Internal server error" });
  }

  const tokenString: string = token;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const decoded = jwt.verify(tokenString, process.env.JWT_SECRET!) as JwtPayload;

    const { email, role } = decoded;

    if (!email || !role || !Object.values(ROLE).includes(role)) {
      logger.warn("Invalid token payload in verifyEmail", { payload: decoded });
      return response.status(400).send("Invalid token payload.");
    }

    const user: User | null = await findUsersEmail(connection, email);

    if (!user) {
      logger.warn("User not found during email verification", { email });
      return response.status(404).send("User not found.");
    }

    if (user.is_registered) return response.status(200).send("User already verified.");

    await markRegistered(connection, email);
    await connection.commit();

    return response.status(200).send("Email verified and account registered!");

  } catch (error: any) {

    if (connection) await connection.rollback();
    
    logger.error("Error during email verification", {
      error,
      name: error?.name || "UnknownError",
      message: error?.message || "No message",
      stack: error?.stack || "No stack trace",
      cause: error ?.cause || "No cause",
    });
    return response.status(400).send("Invalid or expired verification link.");
  } finally {
    if (connection) connection?.release();
  }
};
