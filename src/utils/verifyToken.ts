import express from "express";
import type { Request, Response, Router } from "express";
import type { JwtPayload } from "jsonwebtoken";
import type { Role } from "../types/express/auth.js";
import logger from "../config/logger.js";
import jwt from "jsonwebtoken";

const router: Router = express.Router();

interface AuthTokenPayload extends JwtPayload {
  user_id: number;
  role: Role;
}

router.get("/auth/verify-token", async (request: Request, response: Response) => {
  try {
    let token = request.cookies?.token;

    if (!process.env.JWT_SECRET) {
      logger.error("JWT_SECRET is not configured in the environment.");
      return response.status(500).json({ authenticated: false, message: "Server misconfiguration" });
    }

    // Fallback to Authorization header (from localStorage)
    if (!token && request.headers.authorization?.startsWith("Bearer ")) {
      token = request.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return response.status(200).json({
        authenticated: false,
        role: null,
        message: "Token not found",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as AuthTokenPayload;

    if (typeof decoded !== "object" || !("user_id" in decoded) || !("role" in decoded)) {
      logger.warn("Token has invalid structure", { decoded });
      return response.status(401).json({ authenticated: false, role: null, user: null, message: "Invalid token structure" });
    }

    return response.status(200).json({
      authenticated: true,
      role: decoded.role,
      user: decoded.user_id,
      message: `Authenticated as ${decoded.role}`,
    });

  } catch (error: any) {
    logger.error("Unexpected error in /auth/verify-token", {
      ip: request.ip,
      userAgent: request.headers["user-agent"],
      message: error?.message || "Unknown error",
      stack: error?.stack || "No stack trace",
      name: error?.name || "UnknownError",
      cause: error?.cause || "No cause",
      error,
    });
    return response.status(401).json({
      authenticated: false,
      message: "Invalid or expired token",
    });
  }
});

export default router;
