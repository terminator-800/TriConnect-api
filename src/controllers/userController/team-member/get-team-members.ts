import type { Response } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { AuthenticatedRequest } from '../../../middleware/authenticate.js';
import { ROLE } from '../../../utils/roles.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';

interface TeamMemberRow extends RowDataPacket {
  team_member_id: number;
  manpower_provider_id: number;
  full_name: string;
  job_title: string | null;
  email: string | null;
  location: string | null;
  years_experience: number;
  status: 'available' | 'pending' | 'deploy' | 'completed';
  created_at: Date;
}

export const getTeamMembers = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const ip = req.ip;
  const user = req.user;
  let connection: PoolConnection | undefined;

  if (!user) {
    logger.warn('Unauthorized team members list attempt', { ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user_id, role } = user;

  if (role !== ROLE.MANPOWER_PROVIDER) {
    logger.warn('Forbidden role for team members list', { user_id, role, ip });
    return res.status(403).json({ error: 'Forbidden: Only manpower providers can view team members.' });
  }

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.execute<TeamMemberRow[]>(
      `SELECT team_member_id, manpower_provider_id, full_name, job_title, email, location,
              years_experience, status, created_at
       FROM manpower_team_member
       WHERE manpower_provider_id = ?
       ORDER BY created_at DESC`,
      [user_id]
    );

    return res.status(200).json({ team_members: rows });
  } catch (error: unknown) {
    console.error('[getTeamMembers]', error);
    logger.error('Failed to fetch team members', {
      ip,
      user_id,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });
    return res.status(500).json({ error: 'Failed to fetch team members.' });
  } finally {
    if (connection) connection.release();
  }
};
