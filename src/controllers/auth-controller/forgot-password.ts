import type { Request, Response, RequestHandler } from "express";
import { findUsersEmail } from "../../service/find-user-email-service.js";
import { ROLE } from "../../utils/roles.js";
import jwt from "jsonwebtoken";
import pool from "../../config/database-connection.js";
import nodemailer from "nodemailer";
import logger from "../../config/logger.js";

type Role = typeof ROLE[keyof typeof ROLE];

interface UserRow {
    user_id: number;
    email: string;
    password: string;
    is_registered: number;
    role: Role;
}

export const forgotPassword: RequestHandler = async (req: Request, res: Response) => {
    let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
    const { email } = req.body as { email?: string };

    if (!email) {
        logger.warn("Forgot password request missing email", { ip: req.ip, body: req.body });
        return res.status(400).json({ message: "Email is required." });
    }

    for (const key of ["JWT_SECRET", "EMAIL_USER", "EMAIL_PASS", "CLIENT_ORIGIN"]) {
        if (!process.env[key]) {
            console.error(`Missing required environment variable: ${key}`);
            process.exit(1);
        }
    }

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const user: UserRow | null = await findUsersEmail(connection, email);

        // Always respond the same way to avoid revealing user existence
        if (!user) {
            await connection.rollback();
            return res.status(200).json({
                message: "If this email exists, a reset link has been sent.",
            });
        }

        // Validate role is one of the allowed ROLE values
        if (!Object.values(ROLE).includes(user.role as Role)) {
            logger.warn(`Invalid role detected during forgot password: ${user.role}`, { user });
            await connection.rollback();
            return res.status(400).json({ message: "Invalid role." });
        }

        const token = jwt.sign(
            { user_id: user.user_id, email: user.email },
            process.env.JWT_SECRET!,
            { expiresIn: "10m" }
        );

        const resetLink = `${process.env.CLIENT_ORIGIN ?? "http://localhost:5173"}/forgot-password/reset-password?token=${token}`;

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER!,
                pass: process.env.EMAIL_PASS!,
            },
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER!,
            to: email,
            subject: "Password Reset Request",
            html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link will expire in 10 minutes.</p>`,
        });

        await connection.commit();

        return res.status(200).json({
            message: "If this email exists, a reset link has been sent.",
        });
    } catch (error: any) {
        if (connection) await connection.rollback();
        logger.error("Unexpected error in forgotPassword handler", {
            name: error?.name || "UnknownError",
            message: error?.message || "No message",
            stack: error?.stack || "No stack trace",
            cause: error?.cause || "No cause",
            ip: req.ip,
            email
        });
        return res.status(500).json({ message: "Server error" });
    } finally {
        if (connection) connection.release();
    }
};
