import type { Response } from 'express';
import type { CustomRequest } from '../../../types/express/auth.js';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';
import { ROLE } from '../../../utils/roles.js';

interface PendingDeploymentRow extends RowDataPacket {
  deployment_id: number;
  manpower_provider_id: number;
  project_name: string;
  employer_name: string;
  location: string | null;
  total_employer_monthly: number;
  total_platform_fee: number;
  payment_method: 'gcash' | 'bank_transfer';
  proof_file_path: string;
  proof_original_name: string;
  created_at: Date;
  agency_name: string | null;
  provider_email: string | null;
  member_count: number;
  payment_reference: string | null;
}

export const getPendingDeployments = async (req: CustomRequest, res: Response): Promise<Response> => {
  const ip = req.ip;

  if (req.user?.role !== ROLE.ADMINISTRATOR) {
    logger.warn('Forbidden getPendingDeployments', { user_id: req.user?.user_id, ip });
    return res.status(403).json({ error: 'Forbidden: Admins only.' });
  }

  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();

    const [rows] = await connection.execute<PendingDeploymentRow[]>(
      `SELECT d.deployment_id, d.manpower_provider_id, d.project_name, d.employer_name, d.location,
              d.total_employer_monthly, d.total_platform_fee, d.payment_method, d.payment_reference,
              d.proof_file_path, d.proof_original_name, d.created_at,
              mp.agency_name,
              u.email AS provider_email,
              (SELECT COUNT(*) FROM manpower_deployment_member m WHERE m.deployment_id = d.deployment_id) AS member_count
       FROM manpower_deployment d
       LEFT JOIN manpower_provider mp ON d.manpower_provider_id = mp.manpower_provider_id
       LEFT JOIN users u ON d.manpower_provider_id = u.user_id
       WHERE d.verification_status = 'pending_verification'
       ORDER BY d.created_at ASC`
    );

    return res.status(200).json({ deployments: rows });
  } catch (error: unknown) {
    console.error('[getPendingDeployments]', error);
    logger.error('Failed to fetch pending deployments', {
      ip,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    return res.status(500).json({ error: 'Failed to fetch pending deployments.' });
  } finally {
    if (connection) connection.release();
  }
};
