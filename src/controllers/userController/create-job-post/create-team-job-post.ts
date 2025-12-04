// controllers/teamJobPostController.ts
import type { Request, Response } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ROLE } from '../../../utils/roles.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';
import { countActiveJobPostsAllTables } from './create-job-post-helper.js';
import { notifyUser } from '../notification/notify-user.js';

// Request body type
interface CreateTeamJobPostBody {
  worker_category?: string;
  number_of_workers?: number | null;
  location?: string;
  senior_workers?: number | null;
  mid_level_workers?: number | null;
  junior_workers?: number | null;
  entry_level_workers?: number | null;
  team_skills?: string;
}

// Authenticated user type
interface AuthenticatedUser {
  user_id: number;
  role: (typeof ROLE)[keyof typeof ROLE];
}

// Result types
interface SuccessResult {
  success: true;
  team_job_post_id: number;
  message: string;
}

interface ErrorResult {
  error: string;
  details?: string;
}

type CreateTeamPostResult = SuccessResult | ErrorResult;

// Allowed roles
const allowedRoles: (typeof ROLE)[keyof typeof ROLE][] = [ROLE.MANPOWER_PROVIDER];

// Helper to convert undefined → null
function safe<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

// Controller
export const createTeamJobPost = async (
  request: Request<unknown, unknown, CreateTeamJobPostBody>,
  response: Response
) => {
  const { user } = request as Request & { user: AuthenticatedUser };
  const ip = request.ip;
  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();
    const { user_id, role } = user;

    if (!allowedRoles.includes(role)) {
      logger.warn('Unauthorized role tried to create team job post', { user_id, role, ip });
      return response
        .status(403)
        .json({ error: 'Forbidden: Only manpower providers can create team job posts.' });
    }

    // Prepare input
    const input: TeamJobPostInput = {
      user_id,
      role,
      worker_category: safe(request.body.worker_category),
      number_of_workers: safe(request.body.number_of_workers),
      location: safe(request.body.location),
      senior_workers: safe(request.body.senior_workers),
      mid_level_workers: safe(request.body.mid_level_workers),
      junior_workers: safe(request.body.junior_workers),
      entry_level_workers: safe(request.body.entry_level_workers),
      team_skills: safe(request.body.team_skills),
    };

    // Validate input
    const validation = validateTeamJobPostInput(input);
    if (validation.error) {
      logger.warn('Validation failed for team job post', { user_id, ip, input });
      return response.status(400).json({ error: validation.error });
    }

    // Optional: check active posts limit
    const activePosts = await countActiveJobPostsAllTables(connection, user_id);

    if (activePosts >= 3) {
      logger.info('User reached max active job posts', { user_id, activePosts });
      return response.status(400).json({
        error:
          'You’ve reached the limit of 3 active job posts. Please remove an existing one or upgrade your plan.',
      });
    }

    // Insert into DB
    const team_job_post_id = await insertTeamJobPost(connection, input);

    //Push notification for new job post could be added here
    // This notify to admin
    const userId = 1; // user id for recipient of the notification and this is ADMIN account
    const title = 'NEW JOB POST CREATED';
    const message = `A new job post has been submitted  and is pending for verification. Please review the job details and approve or reject it`;
    const type = 'job_post_status';

    await notifyUser(userId, title, message, type);

    const responseData: SuccessResult = {
      success: true,
      team_job_post_id,
      message: 'Team job post created successfully',
    };

    return response.status(201).json(responseData);
  } catch (error: any) {
    if (connection) await connection.rollback();

    logger.error('Unexpected error in createTeamJobPost controller', {
      error,
      name: error?.name || 'UnknownError',
      message: error?.message || 'No message',
      stack: error?.stack || 'No stack',
      cause: error?.cause || 'No cause',
      ip,
    });

    return response.status(500).json({ error: 'Internal server error.' });
  } finally {
    if (connection) connection.release();
  }
};

// Input type
export interface TeamJobPostInput {
  user_id: number;
  role: string;
  worker_category?: string | null;
  number_of_workers?: number | null;
  location?: string | null;
  senior_workers?: number | null;
  mid_level_workers?: number | null;
  junior_workers?: number | null;
  entry_level_workers?: number | null;
  team_skills?: string | null;
}

// Validation result type
export interface ValidationResult {
  valid?: boolean;
  error?: string;
}

// Validate team job post input
export function validateTeamJobPostInput(data: TeamJobPostInput): ValidationResult {
  const {
    worker_category,
    number_of_workers,
    location,
    senior_workers,
    mid_level_workers,
    junior_workers,
    entry_level_workers,
    team_skills,
  } = data;

  // Require at least worker_category, number_of_workers, location, and team_skills
  if (!worker_category || !number_of_workers || !location || !team_skills) {
    return {
      error: 'Please provide worker category, number of workers, location, and team skills.',
    };
  }

  // Ensure numeric fields are not negative
  const numericFields = [
    number_of_workers,
    senior_workers,
    mid_level_workers,
    junior_workers,
    entry_level_workers,
  ];
  if (numericFields.some((n) => n !== null && n! < 0)) {
    return { error: 'Worker counts cannot be negative.' };
  }

  return { valid: true };
}

// Count active team job posts

// Insert a new team job post
export async function insertTeamJobPost(
  connection: PoolConnection,
  data: TeamJobPostInput
): Promise<number> {
  const {
    user_id,
    worker_category,
    number_of_workers,
    location,
    senior_workers,
    mid_level_workers,
    junior_workers,
    entry_level_workers,
    team_skills,
  } = data;

  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO team_job_post (
                user_id, status, jobpost_status, submitted_at,
                worker_category, number_of_workers, location,
                senior_workers, mid_level_workers, junior_workers, entry_level_workers,
                team_skills
            ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        'pending',
        'pending',
        worker_category ?? null,
        number_of_workers ?? null,
        location ?? null,
        senior_workers ?? null,
        mid_level_workers ?? null,
        junior_workers ?? null,
        entry_level_workers ?? null,
        team_skills ?? null,
      ]
    );

    return result.insertId;
  } catch (error: any) {
    logger.error('Failed to insert team job post', { error, data });
    throw new Error(error?.message || 'Database error while inserting team job post');
  }
}
