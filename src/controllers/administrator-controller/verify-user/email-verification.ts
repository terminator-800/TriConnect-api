import nodemailer from 'nodemailer';
import logger from '../../../config/logger.js';
import sendMail from '../../../service/email-handler.js';

const { EMAIL_USER, EMAIL_PASS, CLIENT_ORIGIN } = process.env;

if (!EMAIL_USER || !EMAIL_PASS) {
  logger.error('Missing email credentials');
  process.exit(1);
}

export async function sendVerificationEmail(to: string, displayName: string) {
  const subject = 'TriConnect Account Approved';
  const html = approvalEmailHTML(displayName);

  try {
    await sendMail(to, subject, html);
    logger.info(`Verification email sent to ${to}`);
  } catch (error: unknown) {
    logger.error(`Failed to send verification email to ${to}`, { error });
    console.log(`Failed to send verification email to ${to}`, { error });
  }
}

export function approvalEmailHTML(displayName: string) {
  return `
    <html>
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
                  <p>Hi, ${displayName},</p>
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
    </html>
  `;
}