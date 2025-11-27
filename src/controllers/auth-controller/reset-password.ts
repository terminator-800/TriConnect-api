import type { Request, Response, RequestHandler } from "express";
import { updateUserPassword } from "./update-password.js";
import type { JwtPayload } from "jsonwebtoken";
import pool from "../../config/database-connection.js";
import jwt from "jsonwebtoken";
import logger from "../../config/logger.js";

interface ResetPasswordBody {
    token?: string;
    password?: string;
}

interface ResetTokenPayload extends JwtPayload {
    email: string;
}

export const resetPassword: RequestHandler = async (req: Request, res: Response) => {
    let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
    const { token, password } = req.body as ResetPasswordBody;

    if (!token || !password) {
        logger.warn("Reset password request missing token or password", { body: req.body, ip: req.ip });
        return res.status(400).json({ message: "Token and new password are required." });
    }

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as ResetTokenPayload;
        const { email } = decoded;

        await updateUserPassword(connection, email, password);
        await connection.commit();

        logger.info("Password reset successfully", { email });
        return res.status(200).json({ message: "Password has been reset successfully." });

    } catch (error: any) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                logger.error("Failed to rollback DB transaction during password reset", { error: rollbackError });
            }
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Your reset link has expired. Please request a new one." });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: "Invalid reset token. Please request a new one." });
        }

        logger.error("Unexpected error during password reset", {
            error: error,
            name: error?.name || "UnknownError",
            message: error?.message || "No message",
            stack: error?.stack || "No stack trace",
            cause: error?.cause || "No cause",
            ip: req.ip
        });
        return res.status(500).json({ message: "Server error" });

    } finally {
        if (connection) connection.release();
    }
};
