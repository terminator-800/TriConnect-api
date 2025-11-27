import type { Request, Response, RequestHandler } from "express";
import { findUsersEmail } from "../../service/find-user-email-service.js";
import { ROLE } from "../../utils/roles.js";
import nodemailer from "nodemailer";
import logger from "../../config/logger.js";
import pool from "../../config/database-connection.js";
import jwt from "jsonwebtoken";

const { JWT_SECRET, EMAIL_USER, EMAIL_PASS, API_BASE_URL } = process.env;

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER!,
    pass: EMAIL_PASS!,
  },
});

// Mapping of roles to human-readable names
const allowedRoles: Record<string, string> = {
  [ROLE.BUSINESS_EMPLOYER]: "business employer",
  [ROLE.INDIVIDUAL_EMPLOYER]: "individual employer",
  [ROLE.JOBSEEKER]: "jobseeker",
  [ROLE.MANPOWER_PROVIDER]: "manpower provider",
};

// Define the expected shape of the user row
interface UserRow {
  user_id: number;
  email: string;
  role: keyof typeof ROLE;
  is_registered: boolean | 0 | 1;
}

export const resendVerification: RequestHandler = async (req: Request, res: Response) => {
  let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  const { email } = req.body as { email?: string };

  if (!email) return res.status(400).json({ message: "Email is required." });

  try {
    connection = await pool.getConnection();
    const user = (await findUsersEmail(connection, email)) as UserRow | null;

    if (!user) {
      connection.release();
      return res.status(404).json({ message: "User not found." });
    }

    if (!allowedRoles[user.role]) {
      if (connection) await connection.rollback();
      return res.status(400).json({ message: "Invalid user role." });
    }

    if (user.is_registered) {
      if (connection) await connection.rollback();
      return res.status(400).json({ message: "User already verified." });
    }

    const token = jwt.sign(
      { email: user.email, role: user.role, user_id: user.user_id },
      JWT_SECRET!,
      { expiresIn: "1h" }
    );

    const verificationLink = `${API_BASE_URL}/${user.role}/verify?token=${token}`;
    const subject = `Verify your ${allowedRoles[user.role]} email`;

    const html = `
      <p>Hello,</p>
      <p>You requested a new verification link for your <strong>${allowedRoles[user.role]}</strong> account.</p>
      <p>Click below to verify your email:</p>
      <a href="${verificationLink}">${verificationLink}</a>
      <p>This link will expire in 1 hour.</p>
    `;

    await transporter.sendMail({
      from: `"TriConnect" <${EMAIL_USER}>`,
      to: email,
      subject,
      html,
    });

    return res.status(200).json({ message: "Verification email resent." });
  } catch (error: any) {
    logger.error("Failed to send verification email", {
      email,
      name: error?.name || "UnknownError",
      message: error?.message || "Unknown error",
      stack: error?.stack || "No stack trace",
      cause: error?.cause || "No cause",
      error,
    });
    return res.status(500).json({ message: "Server error." });
  } finally {
      if (connection) connection.release();
  }
};
