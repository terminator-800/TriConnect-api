import type { Response } from 'express';
import type { CustomRequest } from '../../../types/express/auth.js';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';
import { ROLE } from '../../../utils/roles.js';

export const approveDeployment = async (req: CustomRequest, res: Response): Promise<Response> => {
  const deployment_id = Number(req.params.deployment_id);
  const ip = req.ip;

  if (!deployment_id || Number.isNaN(deployment_id)) {
    return res.status(400).json({ error: 'Valid deployment_id is required.' });
  }

  if (req.user?.role !== ROLE.ADMINISTRATOR) {
    logger.warn('Forbidden approveDeployment', { user_id: req.user?.user_id, ip });
    return res.status(403).json({ error: 'Forbidden: Admins only.' });
  }

  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT deployment_id, verification_status FROM manpower_deployment WHERE deployment_id = ? LIMIT 1`,
      [deployment_id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Deployment not found.' });
    }

    const verification_status = rows[0]?.verification_status;
    if (verification_status !== 'pending_verification') {
      await connection.rollback();
      return res.status(409).json({ error: 'Deployment is not pending verification.' });
    }

    const [upd] = await connection.execute<ResultSetHeader>(
      `UPDATE manpower_deployment SET verification_status = 'verified' WHERE deployment_id = ?`,
      [deployment_id]
    );

    if (upd.affectedRows !== 1) {
      await connection.rollback();
      return res.status(500).json({ error: 'Failed to update deployment.' });
    }

    const [memberRows] = await connection.execute<RowDataPacket[]>(
      `SELECT team_member_id FROM manpower_deployment_member WHERE deployment_id = ?`,
      [deployment_id]
    );

    const ids = memberRows.map((r) => Number(r.team_member_id));
    if (ids.length > 0) {
      const ph = ids.map(() => '?').join(',');
      await connection.execute(
        `UPDATE manpower_team_member
         SET status = 'deploy'
         WHERE team_member_id IN (${ph}) AND status = 'pending'`,
        ids
      );
    }

    await connection.commit();

    return res.status(200).json({
      message: 'Deployment approved. Workers are now in Deploy status.',
      deployment_id,
      team_member_ids: ids,
    });
  } catch (error: unknown) {
    await connection?.rollback();
    console.error('[approveDeployment]', error);
    logger.error('approveDeployment failed', {
      deployment_id,
      ip,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    return res.status(500).json({ error: 'Failed to approve deployment.' });
  } finally {
    if (connection) connection.release();
  }
};
