import { hasSubmittedFeedback, saveFeedback } from './feedback-helper.js';
import type { AuthenticatedUser } from '../../../middleware/authenticate.js';
import type { Request, Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { ROLE } from '../../../utils/roles.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';
import { notifyUser } from '../notification/notify-user.js';

interface FeedbackRequestBody {
  message: string;
}

interface FeedbackRequest extends Request {
  user?: AuthenticatedUser;
  body: FeedbackRequestBody;
}

const allowedRoles: (typeof ROLE)[keyof typeof ROLE][] = [
  ROLE.BUSINESS_EMPLOYER,
  ROLE.INDIVIDUAL_EMPLOYER,
  ROLE.MANPOWER_PROVIDER,
  ROLE.JOBSEEKER,
];

export const submitFeedback = async (req: FeedbackRequest, res: Response): Promise<Response> => {
  let connection: PoolConnection | undefined;
  const ip = req.ip;
  const user = req.user;

  if (!user) {
    logger.warn('Unauthorized feedback attempt', { ip });
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { user_id } = user;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { message } = req.body;

    if (!message?.trim()) {
      logger.warn('Empty feedback message submitted', { user_id, ip });
      return res.status(400).json({ message: 'Feedback message is required.' });
    }

    const alreadySubmitted: boolean = await hasSubmittedFeedback(connection, user_id);

    if (alreadySubmitted) {
      return res.status(409).json({ message: 'You have already submitted feedback.' });
    }

    const feedback = await saveFeedback(connection, user_id, message);

    //Push notification to admin could be added here
    const userId = 1;
    const title = 'NEW FEEDBACK SUBMITTED';
    const notificationMessage = `You have received new feedback check in the user feedback section.`;
    const type = 'system';

    await notifyUser(userId, title, notificationMessage, type);

    await connection.commit();

    return res.status(201).json({
      message: 'Feedback submitted successfully!',
      feedback,
    });
  } catch (error: any) {
    await connection?.rollback();
    logger.error('Failed to submit feedback', {
      ip,
      name: error?.name || 'UnknownError',
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      cause: error?.cause || 'No cause',
      error,
    });
    return res.status(500).json({ message: 'Failed to submit feedback.' });
  } finally {
    if (connection) connection.release();
  }
};
