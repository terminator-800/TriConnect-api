import dotenv from 'dotenv';
dotenv.config();
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { CustomRequest } from '../../../types/express/auth.js';
import type { Response } from 'express';
import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';
import nodemailer from 'nodemailer';
import { notifyUser } from '../../userController/notification/notify-user.js';
import { sendVerificationEmail } from './email-verification.js';

const { EMAIL_USER, EMAIL_PASS, CLIENT_ORIGIN } = process.env;

if (!EMAIL_USER || !EMAIL_PASS || !CLIENT_ORIGIN) {
  logger.error('Missing required environment variables for verifyUser email');
  process.exit(1);
}

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: EMAIL_USER,
//     pass: EMAIL_PASS,
//   },
// });

const notifyUserApproval = async (user_id: number, displayName: string) => {
  const admin = 1; // notifier_id is always admin user_id 1 for notifications
  await notifyUser(
    user_id,
    'REQUIREMENTS APPROVED',
    `Hi, ${displayName}, your submitted requirements have been approved. Please check your email for details and access your account.`,
    'account_verification',
    admin,
  );
};

// const getUserEmail = async (connection: PoolConnection, user_id: number): Promise<string> => {
//   const [rows] = await connection.execute<RowDataPacket[]>(
//     `SELECT email FROM users WHERE user_id = ?`,
//     [user_id]
//   );

//   if (rows.length === 0 || !rows[0]?.email) {
//     throw new Error(`Email not found for user ID ${user_id}`);
//   }

//   return rows[0].email;
// };

export const verifyUser = async (req: CustomRequest, res: Response) => {
    const user_id = Number(req.params.user_id);

    if (!user_id) {
      logger.warn('verifyUser called without user_id', { ip: req.ip, user: req.user });
      return res.status(400).json({ message: 'User ID is required.' });
    }

    if (req.user?.role !== 'administrator') {
      logger.warn(`Unauthorized verify attempt by user ID ${req.user?.user_id}`);
      return res.status(403).json({ message: 'Forbidden: Admins only.' });
    }

  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();

    // Get the user's display name and and email to verify them
    const { displayName, userEmail } = await getUserNameAndEmail(connection, user_id);
    connection.release();
    connection = undefined;
    
    // sends an email verification and notification to the user after approval
    await Promise.all([
        sendVerificationEmail(userEmail, displayName),
        notifyUserApproval(user_id, displayName),
      ]);

    res.json({ success: true, message: 'User verified and approval email sent.' });
  } catch (error: any) {
    logger.error('Unexpected error in verifyUser endpoint', {
      ip: req.ip,
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      name: error?.name || 'UnknownError',
      cause: error?.cause || 'No cause',
      error,
    });
    console.error(`[verifyUser] Failed to verify user ID ${user_id}:`, error);    
    res.status(500).json({ message: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
};

async function getUserNameAndEmail(connection: PoolConnection, user_id: string | number): Promise<{ displayName: string; userEmail: string }> {
  // 1. Get the user's role and email
  const [userRows] = await connection.execute<RowDataPacket[]>(
    `SELECT role, email FROM users WHERE user_id = ?`,
    [user_id]
  );

  if (userRows.length === 0 || !userRows[0]?.role) {
    throw new Error('User not found or role is undefined.');
  }

  const userRole = userRows[0].role as string;
  const userEmail = userRows[0].email as string;
  let displayName: string;

  // 2. Get display name based on role
  switch (userRole) {
    case 'jobseeker': {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT full_name FROM jobseeker WHERE jobseeker_id = ?`,
        [user_id]
      );
      if (rows.length === 0 || !rows[0]?.full_name) throw new Error('Jobseeker profile not found.');
      displayName = rows[0].full_name!;
      break;
    }

    case 'business-employer': {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT business_name FROM business_employer WHERE business_employer_id = ?`,
        [user_id]
      );
      if (rows.length === 0 || !rows[0]?.business_name)
        throw new Error('Business employer profile not found.');
      displayName = rows[0].business_name!;
      break;
    }

    case 'individual-employer': {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT full_name FROM individual_employer WHERE individual_employer_id = ?`,
        [user_id]
      );
      if (rows.length === 0 || !rows[0]?.full_name)
        throw new Error('Individual employer profile not found.');
      displayName = rows[0].full_name!;
      break;
    }

    case 'manpower-provider': {
      const [rows] = await connection.execute<RowDataPacket[]>(
        `SELECT agency_name FROM manpower_provider WHERE manpower_provider_id = ?`,
        [user_id]
      );
      if (rows.length === 0 || !rows[0]?.agency_name)
        throw new Error('Manpower provider profile not found.');
      displayName = rows[0].agency_name!;
      break;
    }

    default:
      throw new Error('Unsupported user role.');
  }

  // 3. Update the user as verified
  const [updateResult] = await connection.execute<ResultSetHeader>(
    `UPDATE users 
     SET is_verified = ?, is_rejected = ?, verified_at = NOW() 
     WHERE user_id = ?`,
    [true, false, user_id]
  );

  if (updateResult.affectedRows === 0) {
    throw new Error('User verification failed.');
  }

  return { displayName, userEmail };
}
