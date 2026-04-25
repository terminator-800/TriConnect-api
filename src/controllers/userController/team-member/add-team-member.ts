import type { Response } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AuthenticatedRequest } from '../../../middleware/authenticate.js';
import { ROLE } from '../../../utils/roles.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';

interface AddTeamMemberBody {
  full_name?: string;
  job_title?: string;
  email?: string;
  location?: string;
  years_experience?: number | string;
}

interface InsertedTeamMember extends RowDataPacket {
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

export const addTeamMember = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const ip = req.ip;
  const user = req.user;
  let connection: PoolConnection | undefined;

  if (!user) {
    logger.warn('Unauthorized add team member attempt', { ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user_id, role } = user;

  if (role !== ROLE.MANPOWER_PROVIDER) {
    logger.warn('Forbidden role for add team member', { user_id, role, ip });
    return res.status(403).json({ error: 'Forbidden: Only manpower providers can add team members.' });
  }

  const body = req.body as AddTeamMemberBody;
  const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const job_title =
    typeof body.job_title === 'string' && body.job_title.trim() !== '' ? body.job_title.trim() : null;
  const email =
    typeof body.email === 'string' && body.email.trim() !== '' ? body.email.trim() : null;
  const location =
    typeof body.location === 'string' && body.location.trim() !== '' ? body.location.trim() : null;

  const yearsParsed =
    typeof body.years_experience === 'number'
      ? body.years_experience
      : parseInt(String(body.years_experience ?? ''), 10);

  if (!full_name) {
    return res.status(400).json({ error: 'Full name is required.' });
  }

  if (Number.isNaN(yearsParsed) || yearsParsed < 0) {
    return res.status(400).json({ error: 'Years of experience must be a valid non-negative number.' });
  }

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO manpower_team_member
        (manpower_provider_id, full_name, job_title, email, location, years_experience, status)
       VALUES (?, ?, ?, ?, ?, ?, 'available')`,
      [user_id, full_name, job_title, email, location, yearsParsed]
    );

    const insertId = result.insertId;

    const [rows] = await connection.execute<InsertedTeamMember[]>(
      `SELECT team_member_id, manpower_provider_id, full_name, job_title, email, location,
              years_experience, status, created_at
       FROM manpower_team_member
       WHERE team_member_id = ? AND manpower_provider_id = ?
       LIMIT 1`,
      [insertId, user_id]
    );

    await connection.commit();

    const team_member = rows[0];
    if (!team_member) {
      logger.error('Insert succeeded but row not found after add team member', { insertId, user_id, ip });
      return res.status(500).json({ error: 'Failed to load created team member.' });
    }

    return res.status(201).json({
      message: 'Team member added successfully.',
      team_member,
    });
  } catch (error: unknown) {
    console.error('[addTeamMember]', error);
    await connection?.rollback();
    logger.error('Failed to add team member', {
      ip,
      user_id,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });
    return res.status(500).json({ error: 'Failed to add team member.' });
  } finally {
    if (connection) connection.release();
  }
};
