import dotenv from 'dotenv';
dotenv.config();
import type { Request, Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { findUsersEmail } from '../../../service/find-user-email-service.js';
import { createUsers } from './create-user.js';
import type { User } from '../../../interface/interface.js';
import { ROLE } from '../../../utils/roles.js';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';
import jwt from 'jsonwebtoken';

const { CLIENT_ORIGIN, JWT_SECRET, EMAIL_USER, EMAIL_PASS } = process.env;

if (!CLIENT_ORIGIN || !JWT_SECRET || !EMAIL_USER || !EMAIL_PASS) {
  logger.error('Missing required environment variables for registerUser');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

const allowedRoles: Partial<Record<keyof typeof ROLE, string>> = {
  [ROLE.BUSINESS_EMPLOYER]: 'business employer',
  [ROLE.INDIVIDUAL_EMPLOYER]: 'individual employer',
  [ROLE.JOBSEEKER]: 'jobseeker',
  [ROLE.MANPOWER_PROVIDER]: 'manpower provider',
};

interface RegisterUserBody {
  email: string;
  role: keyof typeof ROLE;
  password: string;
}

interface JwtPayload {
  email: string;
  role: keyof typeof ROLE;
}

export const registerUser = async (
  request: Request<unknown, unknown, RegisterUserBody>,
  response: Response
) => {
  let connection: PoolConnection | undefined;
  type AllowedRoleKey = keyof typeof ROLE;
  const ip = request.ip;

  const { email, role, password } = request.body as {
    email: string;
    role: AllowedRoleKey;
    password: string;
  };

  if (!email || !role || !password) {
    logger.warn('Missing required fields in registerUser', { email, role, ip });
    return response.status(400).json({ message: 'Missing email, role, or password.' });
  }

  if (!(role in allowedRoles)) {
    logger.warn('Invalid role type in registerUser', { role, ip });
    return response.status(400).json({ message: 'Invalid role type.' });
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const existingUser: User | null = await findUsersEmail(connection, email);

    if (existingUser) {
      logger.warn('Attempt to register with existing email', { email, ip });
      await connection.rollback();
      return response.status(409).json({ message: 'Email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await createUsers(connection, email, hashedPassword, role);

    if (!result.success || !result.user_id) {
      logger.error('Failed to create user', { result, email, role, ip });
      await connection.rollback();
      return response.status(500).json({ message: 'Failed to create user.' });
    }

    await connection.commit();

    const token = jwt.sign({ email, role }, JWT_SECRET, { expiresIn: '1h' });
    const verificationLink = `${process.env.API_BASE_URL}/${role}/verify?token=${token}`;
    const emailSubject = `Verify your ${allowedRoles[role]} email`;

    const htmlMessage = `
        <head>
            <style>
          /* Mobile responsiveness */
          @media only screen and (max-width: 480px) {
            .container {
              width: 90% !important;
              padding: 20px !important;
            }
            .button {
              width: 100% !important;
              box-sizing: border-box;
            }
            td {
              font-size: 16px !important;
              line-height: 24px !important;
            }
          }
        </style>
      </head>
      <body style="margin:0; padding:0; font-family:'Inter', Arial, sans-serif; background-color:#F5F5F5;">

        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F5F5; padding:50px 0;">
          <tr>
            <td align="center">

              <!-- Container -->
              <table class="container" width="400" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; font-family:'Inter', Arial, sans-serif; max-width:400px; width:100%;">
                
                <!-- Header -->
                <tr>
                  <td style="background-color:#2F6CE5; color:#ffffff; text-align:center; padding:20px; font-size:20px; font-weight:bold; font-family:'Inter', Arial, sans-serif;">
                    Verify Your Email
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:30px; color:#333333; font-size:14px; line-height:20px; font-family:'Inter', Arial, sans-serif;">
                    <p>Hi ${email},</p>
                    <p>Thank you for creating an account with TriConnect!</p>
                    <p>Please verify your email by clicking the button below:</p>

                    <p style="text-align:center; margin:30px 0;">
                      <a href="${verificationLink}" class="button" style="background-color:#2F6CE5; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:5px; display:inline-block; font-weight:bold; font-family:'Inter', Arial, sans-serif;">
                        Verify My Email
                      </a>
                    </p>

                    <p>Once your email is verified, you’ll be able to submit your requirements so the admin team can review your account.</p>

                    <p>Thank you,<br>
                      The <strong>TriConnect Team</strong></p>
                  </td>
                </tr>

              </table>
              <!-- End Container -->

            </td>
          </tr>
        </table>
    `;

    await transporter.sendMail({
      from: `"TriConnect" <${EMAIL_USER}>`,
      to: email,
      subject: emailSubject,
      html: htmlMessage,
    });

    return response.status(201).json({
      message: 'Verification email sent. Please check your inbox.',
    });
  } catch (error: any) {
    await connection?.rollback();
    logger.error('Unexpected error in registerUser', {
      ip,
      name: error?.name || 'UnknownError',
      message: error?.message || 'Unknown error during user registration',
      stack: error?.stack || 'No stack trace',
      cause: error?.cause || 'No cause',
      error,
    });

    return response.status(500).json({ message: 'Server error.' });
  } finally {
    if (connection) connection.release();
  }
};
