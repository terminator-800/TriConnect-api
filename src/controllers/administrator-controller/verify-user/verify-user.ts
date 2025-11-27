import dotenv from 'dotenv';
dotenv.config();
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import type { CustomRequest } from "../../../types/express/auth.js";
import type { Response } from "express";
import pool from "../../../config/database-connection.js";
import logger from "../../../config/logger.js";
import nodemailer from "nodemailer";
import { notifyUser } from '../../userController/notification/notify-user.js'

const { EMAIL_USER, EMAIL_PASS, CLIENT_ORIGIN } = process.env;

if (!EMAIL_USER || !EMAIL_PASS || !CLIENT_ORIGIN) {
  logger.error("Missing required environment variables for verifyUser email");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

export const verifyUser = async (req: CustomRequest, res: Response) => {
  const user_id = req.params.user_id;

  if (!user_id) {
    logger.warn("verifyUser called without user_id", { ip: req.ip, user: req.user });
    return res.status(400).json({ message: "User ID is required." });
  }

  if (req.user?.role !== "administrator") {
    logger.warn(`Unauthorized verify attempt by user ID ${req.user?.user_id}`);
    return res.status(403).json({ message: "Forbidden: Admins only." });
  }

  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();

    // 1. Get the user's display name and verify them
    const displayName = await verifyUsers(connection, user_id);

    // 2. Get the email to send the notification
    const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT email FROM users WHERE user_id = ?`,
    [user_id]
    );

    if (rows.length === 0 || !rows[0]?.email) {
      throw new Error("User email not found.");
    }
    const userEmail = rows[0]?.email;

    // 3. Send approval email
    const emailSubject = "Your TriConnect account has been approved!";
    const htmlMessage = `
      <head>
        <style>
          @media only screen and (max-width: 480px) {
            .container { width: 90% !important; padding: 20px !important; }
            .button { width: 100% !important; box-sizing: border-box; }
            td { font-size: 16px !important; line-height: 24px !important; }
          }
        </style>
      </head>
      <body style="margin:0; padding:0; font-family:'Inter', Arial, sans-serif; background-color:#F5F5F5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F5F5; padding:50px 0;">
          <tr>
            <td align="center">
              <table class="container" width="400" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; font-family:'Inter', Arial, sans-serif; max-width:400px; width:100%;">
                <tr>
                  <td style="background-color:#30AF35; color:#ffffff; text-align:center; padding:20px; font-size:20px; font-weight:bold;">
                    Account Approved!
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px; color:#333333; font-size:14px; line-height:20px;">
                    <p>Hi ${displayName},</p>
                    <p>Congratulations! Your TriConnect account has been approved by our admin team.</p>
                    <p>You can now log in and start using all the features of your account.</p>
                    <p style="text-align:center; margin:30px 0;">
                      <a href="${CLIENT_ORIGIN}/login" class="button" style="background-color:#30AF35; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:5px; display:inline-block; font-weight:bold;">
                        Go to Dashboard
                      </a>
                    </p>
                    <p>Thank you,<br>The <strong>TriConnect Team</strong></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    `;

    try {
      await transporter.sendMail({
        from: `"TriConnect" <${EMAIL_USER}>`,
        to: userEmail,
        subject: emailSubject,
        html: htmlMessage,
      });
    } catch (emailError) {
      logger.error("Failed to send approval email", { email: userEmail, emailError });
    }

    const io = req.app.get("io");
    const userSocketMap = req.app.get("userSocketMap");
    const socketId = userSocketMap[user_id];

   try {
      if (socketId) {
        io.to(socketId).emit("notification", {
          title: "REQUIREMENTS APPROVED",
          message: `Hi ${displayName}, your submitted requirements have been approved. Please check your email for details and access your account.`,
          type: "system",
          notifier_id: req.user?.user_id,
          created_at: new Date(),
        });
      }
    } catch (socketError) {
      logger.error("Failed to emit socket notification", { user_id, socketError });
    }

    await notifyUser(
      Number(user_id),
      "REQUIREMENTS APPROVED",
      `Hi ${displayName}, your submitted requirements have been approved. Please check your email for details and access your account.`,
      "account_verification",
      req.user?.user_id ?? null
    );


    res.json({ success: true, message: "User verified and approval email sent." });

  } catch (error: any) {
    logger.error("Unexpected error in verifyUser endpoint", {
      ip: req.ip,
      message: error?.message || "Unknown error",
      stack: error?.stack || "No stack trace",
      name: error?.name || "UnknownError",
      cause: error?.cause || "No cause",
      error,
    });
    res.status(500).json({ message: "Internal server error." });
  } finally {
    if (connection) connection.release();
  }
};

async function verifyUsers(connection: PoolConnection, user_id: string | number): Promise<string> {
  // 1. Get the user's role
  const [userRows] = await connection.execute<RowDataPacket[]>(
    `SELECT role FROM users WHERE user_id = ?`,
    [user_id]
  );

  if (userRows.length === 0 || !userRows[0]?.role) {
    throw new Error("User not found or role is undefined.");
  }

  const userRole = userRows[0].role as string;
  let displayName: string;

  // 2. Get display name based on role
  switch (userRole) {
    case "jobseeker": {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT full_name FROM jobseeker WHERE jobseeker_id = ?`,
        [user_id]
      );
      if (rows.length === 0 || !rows[0]?.full_name) throw new Error("Jobseeker profile not found.");
      displayName = rows[0].full_name!;
      break;
    }

    case "business-employer": {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT business_name FROM business_employer WHERE business_employer_id = ?`,
        [user_id]
      );
      if (rows.length === 0 || !rows[0]?.business_name) throw new Error("Business employer profile not found.");
      displayName = rows[0].business_name!;
      break;
    }

    case "individual-employer": {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT full_name FROM individual_employer WHERE individual_employer_id = ?`,
        [user_id]
      );
      if (rows.length === 0 || !rows[0]?.full_name) throw new Error("Individual employer profile not found.");
      displayName = rows[0].full_name!;
      break;
    }

    case "manpower-provider": {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT agency_name FROM manpower_provider WHERE manpower_provider_id = ?`,
        [user_id]
      );
      if (rows.length === 0 || !rows[0]?.agency_name) throw new Error("Manpower provider profile not found.");
      displayName = rows[0].agency_name!;
      break;
    }

    default:
      throw new Error("Unsupported user role.");
  }

  // 3. Update the user as verified
  const [updateResult] = await connection.execute<ResultSetHeader>(
    `UPDATE users 
     SET is_verified = ?, is_rejected = ?, verified_at = NOW() 
     WHERE user_id = ?`,
    [true, false, user_id]
  );

  if (updateResult.affectedRows === 0) {
    throw new Error("User verification failed.");
  }

  return displayName;
}
