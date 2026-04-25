import type { Response } from 'express';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { AuthenticatedRequest } from '../../../middleware/authenticate.js';
import { ROLE } from '../../../utils/roles.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';

interface DeploymentRow extends RowDataPacket {
  deployment_id: number;
  manpower_provider_id: number;
  project_name: string;
  employer_name: string;
  location: string | null;
  start_date: Date | null;
  end_date: Date | null;
  site_contact: string | null;
  total_employer_monthly: number;
  total_platform_fee: number;
  payment_method: 'gcash' | 'bank_transfer';
  payment_reference: string | null;
  proof_file_path: string;
  proof_original_name: string;
  verification_status: 'pending_verification' | 'verified' | 'rejected';
  created_at: Date;
  member_count: number;
}

export const getDeployments = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const ip = req.ip;
  const user = req.user;
  let connection: PoolConnection | undefined;

  if (!user) {
    logger.warn('Unauthorized deployments list attempt', { ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user_id, role } = user;

  if (role !== ROLE.MANPOWER_PROVIDER) {
    logger.warn('Forbidden role for deployments list', { user_id, role, ip });
    return res.status(403).json({ error: 'Forbidden: Only manpower providers can view deployments.' });
  }

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.execute<DeploymentRow[]>(
      `SELECT d.deployment_id, d.manpower_provider_id, d.project_name, d.employer_name, d.location,
              d.start_date, d.end_date, d.site_contact, d.total_employer_monthly, d.total_platform_fee,
              d.payment_method, d.payment_reference, d.proof_file_path, d.proof_original_name,
              d.verification_status, d.created_at,
              (SELECT COUNT(*) FROM manpower_deployment_member m WHERE m.deployment_id = d.deployment_id) AS member_count
       FROM manpower_deployment d
       WHERE d.manpower_provider_id = ?
       ORDER BY d.created_at DESC`,
      [user_id]
    );

    return res.status(200).json({ deployments: rows });
  } catch (error: unknown) {
    console.error('[getDeployments]', error);
    logger.error('Failed to fetch deployments', {
      ip,
      user_id,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });
    return res.status(500).json({ error: 'Failed to fetch deployments.' });
  } finally {
    if (connection) connection.release();
  }
};
