import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export default async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const { BREVO_API_KEY, EMAIL_USER } = process.env as {
    BREVO_API_KEY: string;
    EMAIL_USER: string;
  };

  const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

  await axios.post(
    BREVO_API_URL,
    {
      to: [{ email: to }],
      sender: { email: EMAIL_USER! },
      subject,
      htmlContent: html,
    },
    {
      headers: {
        'api-key': BREVO_API_KEY!,
        'Content-Type': 'application/json',
      },
    }
  );
}
