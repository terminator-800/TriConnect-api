import nodemailer from "nodemailer";
import logger from "../../../config/logger.js";

const { EMAIL_USER, EMAIL_PASS, CLIENT_ORIGIN } = process.env;

if (!EMAIL_USER || !EMAIL_PASS) {
  logger.error("Missing email credentials");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

/**
 * Sends an email to a user.
 */
export async function sendUserEmail(to: string, subject: string, htmlContent: string) {
  try {
    await transporter.sendMail({
      from: `"TriConnect" <${EMAIL_USER}>`,
      to,
      subject,
      html: htmlContent,
    });
    logger.info(`Email sent to ${to} with subject "${subject}"`);
  } catch (error: any) {
    logger.error(`Failed to send email to ${to}`, { error });
  }
}


const baseStyles = `
<style>
  @media only screen and (max-width: 480px) {
    .container { width: 90% !important; padding: 20px !important; }
    .button { width: 100% !important; box-sizing: border-box; }
    td { font-size: 16px !important; line-height: 24px !important; }
  }
</style>
`;

export function getRejectionEmailHTML(displayName: string) {
  return `
  <head>${baseStyles}</head>
  <body style="margin:0; padding:0; font-family:'Inter', Arial, sans-serif; background-color:#F5F5F5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F5F5; padding:50px 0;">
      <tr>
        <td align="center">
          <table class="container" width="400" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; max-width:400px; width:100%;">
            <tr>
              <td style="background-color:#FF4C4C; color:#ffffff; text-align:center; padding:20px; font-size:20px; font-weight:bold;">
                Account Rejected
              </td>
            </tr>
            <tr>
              <td style="padding:30px; color:#333333; font-size:14px; line-height:20px;">
                <p>Hi ${displayName},</p>
                <p>We reviewed the documents you submitted, but 
                    unfortunately, we cannot approve your account 
                    at this time.
                </p>
                <p>
                    To continue using TriConnect, please re-upload
                    the correct or complete requirements.
                </p>
                <p style="text-align:center; margin:30px 0;">
                      <a href="${CLIENT_ORIGIN}/login" class="button" style="background-color:#D71E1E; color:#ffffff; text-decoration:none; padding:12px 24px; border-radius:5px; display:inline-block; font-weight:bold;">
                        Resubmit Again
                      </a>
                    </p>
                <p>Best Regards,<br>The <strong>TriConnect Team</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  `;
}