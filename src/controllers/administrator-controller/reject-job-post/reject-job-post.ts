import type { Router, Request, Response } from 'express';
import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';

const JOB_POST_TABLES = {
  hiring: { table: 'job_post', pk: 'job_post_id' },
  individual: { table: 'individual_job_post', pk: 'individual_job_post_id' },
  team: { table: 'team_job_post', pk: 'team_job_post_id' },
} as const;

interface RejectPostResult {
  success: boolean;
  message: string;
}

async function rejectPost(
  connection: any,
  table: string,
  pkColumn: string,
  id: number
): Promise<RejectPostResult> {
  const [rows] = await connection.query(`SELECT * FROM ${table} WHERE ${pkColumn} = ?`, [id]);

  if (!rows.length) {
    return { success: false, message: `${table} record not found.` };
  }

  await connection.query(
    `UPDATE ${table} SET status = 'rejected', is_verified_jobpost = FALSE WHERE ${pkColumn} = ?`,
    [id]
  );

  return { success: true, message: `${table} record rejected successfully.` };
}

type JobPostType = keyof typeof JOB_POST_TABLES;

export const rejectAnyJobPost = async (req: Request, res: Response) => {
  const type = req.body.type as JobPostType;
  const id = Number(req.body.id);

  if (req.user?.role !== 'administrator') {
    res.status(403).json({ error: 'Forbidden: Admins only.' });
    return;
  }

  if (!type || !id) {
    res.status(400).json({ error: 'Missing type or id in request' });
    return;
  }

  const mapping = JOB_POST_TABLES[type];

  if (!mapping) {
    res.status(400).json({ error: 'Invalid job post type' });
    return;
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const result = await rejectPost(connection, mapping.table, mapping.pk, id);

    if (!result.success) {
      res.status(404).json({ error: result.message });
      return;
    }

    res.status(200).json({ message: result.message });
  } catch (error: any) {
    logger.error('Error rejecting job post', { error });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (connection) connection.release();
  }
};
