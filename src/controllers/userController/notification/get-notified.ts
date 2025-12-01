import type { CustomRequest } from '../../../types/express/auth.js';
import type { RowDataPacket, PoolConnection } from 'mysql2/promise';
import type { Response } from 'express';
import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';

interface Notification extends RowDataPacket {
  notification_id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: string;
  notifier_id?: number | null;
  notifier?: Record<string, any> | null; // optional, will hold notifier info
}

export const getNotified = async (req: CustomRequest, res: Response) => {
  let connection: PoolConnection | undefined;
  try {
    const user_id = req.user?.user_id;
    if (!user_id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    connection = await pool.getConnection();

    const [rows] = await connection.query<Notification[]>(
      `
      SELECT 
        notification_id, 
        title, 
        message, 
        CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at,
        is_read, 
        notifier_id, 
        type
      FROM notifications
      WHERE user_id = ? AND is_read = FALSE
      ORDER BY created_at DESC
      `,
      [user_id]
    );

    const notificationsWithNotifier = await Promise.all(
      rows.map(async (notif) => {
        const formattedTime = formatTimeAgo(notif.created_at);

        if (notif.notifier_id) {
          const notifier = await getNotifierCredentials(notif.notifier_id);
          return { ...notif, notifier, created_at: formattedTime };
        }

        return { ...notif, notifier: null, created_at: formattedTime };
      })
    );

    return res.json(notificationsWithNotifier);
  } catch (error: any) {
    logger.error('Error in getNotified controller', {
      ip: req.ip,
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      error,
    });
    return res.status(500).json({ message: 'Failed to fetch notifications.' });
  } finally {
    if (connection) connection.release();
  }
};

export async function getNotifierCredentials(notifier_id: number) {
  let connection: PoolConnection | undefined;
  try {
    connection = await pool.getConnection();

    // 1. Get the role of the notifier
    const [userRows] = await connection.execute<RowDataPacket[]>(
      `SELECT role FROM users WHERE user_id = ?`,
      [notifier_id]
    );

    if (!userRows.length) {
      return null; // notifier not found
    }

    const role = userRows[0]?.role as string;

    // 2. Get role-specific info
    switch (role) {
      case 'administrator':
        return { role: 'Admin' };

      case 'jobseeker': {
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT full_name FROM jobseeker WHERE jobseeker_id = ?`,
          [notifier_id]
        );
        return rows.length ? { role, full_name: rows[0]?.full_name } : null;
      }

      case 'business-employer': {
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT business_name, authorized_person FROM business_employer WHERE business_employer_id = ?`,
          [notifier_id]
        );
        return rows.length
          ? {
              role,
              business_name: rows[0]?.business_name,
              authorized_person: rows[0]?.authorized_person,
            }
          : null;
      }

      case 'individual-employer': {
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT full_name FROM individual_employer WHERE individual_employer_id = ?`,
          [notifier_id]
        );
        return rows.length ? { role, full_name: rows[0]?.full_name } : null;
      }

      case 'manpower-provider': {
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT agency_name, agency_authorized_person FROM manpower_provider WHERE manpower_provider_id = ?`,
          [notifier_id]
        );
        return rows.length
          ? {
              role,
              agency_name: rows[0]?.agency_name,
              agency_authorized_person: rows[0]?.agency_authorized_person,
            }
          : null;
      }

      default:
        return { role }; // fallback
    }
  } catch (error: any) {
    logger.error('Failed to fetch notifier credentials', { notifier_id, error });
    return null;
  } finally {
    if (connection) connection.release();
  }
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}
