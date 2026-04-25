import type { Response } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import type { AuthenticatedRequest } from '../../../middleware/authenticate.js';
import { ROLE } from '../../../utils/roles.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';
import { uploadToCloudinary } from '../../../utils/upload-to-cloudinary.js';

const PLATFORM_PCT = 0.1;

interface PayloadMember {
  team_member_id?: number;
  worker_rate?: number;
}

interface SubmitDeploymentPayload {
  project_name?: string;
  employer_name?: string;
  location?: string;
  start_date?: string | null;
  end_date?: string | null;
  site_contact?: string | null;
  payment_method?: string;
  payment_reference?: string | null;
  members?: PayloadMember[];
}

interface TeamMemberCheck extends RowDataPacket {
  team_member_id: number;
  status: 'available' | 'pending' | 'deploy' | 'completed';
}

function parseOptionalDate(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export const submitDeployment = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const ip = req.ip;
  const user = req.user;
  let connection: PoolConnection | undefined;

  if (!user) {
    logger.warn('Unauthorized deployment submit attempt', { ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user_id, role } = user;

  if (role !== ROLE.MANPOWER_PROVIDER) {
    logger.warn('Forbidden role for deployment submit', { user_id, role, ip });
    return res.status(403).json({ error: 'Forbidden: Only manpower providers can submit deployments.' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Payment receipt file is required.' });
  }

  const tempUploadPath = req.file.path;

  let payload: SubmitDeploymentPayload;
  try {
    const raw = req.body?.payload;
    if (typeof raw !== 'string') {
      await safeUnlink(tempUploadPath);
      return res.status(400).json({ error: 'Missing deployment payload.' });
    }
    payload = JSON.parse(raw) as SubmitDeploymentPayload;
  } catch {
    await safeUnlink(tempUploadPath);
    return res.status(400).json({ error: 'Invalid deployment payload JSON.' });
  }

  const project_name =
    typeof payload.project_name === 'string' ? payload.project_name.trim() : '';
  const employer_name =
    typeof payload.employer_name === 'string' ? payload.employer_name.trim() : '';
  const location =
    typeof payload.location === 'string' && payload.location.trim() !== ''
      ? payload.location.trim()
      : null;
  const site_contact =
    typeof payload.site_contact === 'string' && payload.site_contact.trim() !== ''
      ? payload.site_contact.trim()
      : null;

  const payment_method_raw = payload.payment_method;
  const payment_method =
    payment_method_raw === 'gcash' || payment_method_raw === 'bank_transfer'
      ? payment_method_raw
      : null;

  const payment_reference =
    typeof payload.payment_reference === 'string' && payload.payment_reference.trim() !== ''
      ? payload.payment_reference.trim().slice(0, 120)
      : null;

  const start_date = parseOptionalDate(payload.start_date ?? null);
  const end_date = parseOptionalDate(payload.end_date ?? null);

  if (!project_name) {
    await safeUnlink(tempUploadPath);
    return res.status(400).json({ error: 'Project name is required.' });
  }
  if (!employer_name) {
    await safeUnlink(tempUploadPath);
    return res.status(400).json({ error: 'Employer name is required.' });
  }
  if (!payment_method) {
    await safeUnlink(tempUploadPath);
    return res.status(400).json({ error: 'Payment method must be gcash or bank_transfer.' });
  }

  const members = Array.isArray(payload.members) ? payload.members : [];
  if (members.length === 0) {
    await safeUnlink(tempUploadPath);
    return res.status(400).json({ error: 'At least one team member is required.' });
  }

  const normalized: { team_member_id: number; worker_rate: number; platform_fee: number }[] = [];
  const seenIds = new Set<number>();

  for (const m of members) {
    const tid =
      typeof m.team_member_id === 'number'
        ? m.team_member_id
        : parseInt(String(m.team_member_id ?? ''), 10);
    const rate =
      typeof m.worker_rate === 'number'
        ? m.worker_rate
        : parseInt(String(m.worker_rate ?? ''), 10);

    if (Number.isNaN(tid) || tid <= 0) {
      await safeUnlink(tempUploadPath);
      return res.status(400).json({ error: 'Each member must have a valid team_member_id.' });
    }
    if (Number.isNaN(rate) || rate <= 0) {
      await safeUnlink(tempUploadPath);
      return res.status(400).json({ error: 'Each member must have a positive worker_rate.' });
    }
    if (seenIds.has(tid)) {
      await safeUnlink(tempUploadPath);
      return res.status(400).json({ error: 'Duplicate team member in deployment batch.' });
    }
    seenIds.add(tid);
    const platform_fee = Math.round(rate * PLATFORM_PCT);
    normalized.push({ team_member_id: tid, worker_rate: rate, platform_fee });
  }

  const teamMemberIds = normalized.map((n) => n.team_member_id);
  const placeholders = teamMemberIds.map(() => '?').join(',');

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [memberRows] = await connection.execute<TeamMemberCheck[]>(
      `SELECT team_member_id, status FROM manpower_team_member
       WHERE manpower_provider_id = ? AND team_member_id IN (${placeholders})`,
      [user_id, ...teamMemberIds]
    );

    if (memberRows.length !== teamMemberIds.length) {
      await connection.rollback();
      await safeUnlink(tempUploadPath);
      return res.status(400).json({ error: 'One or more team members were not found for your agency.' });
    }

    for (const row of memberRows) {
      if (row.status !== 'available') {
        await connection.rollback();
        await safeUnlink(tempUploadPath);
        return res.status(409).json({
          error: 'All workers in a deployment must currently have status Available.',
        });
      }
    }

    const [pendingRows] = await connection.execute<RowDataPacket[]>(
      `SELECT DISTINCT ddm.team_member_id
       FROM manpower_deployment_member ddm
       INNER JOIN manpower_deployment dd ON ddm.deployment_id = dd.deployment_id
       WHERE dd.manpower_provider_id = ?
         AND dd.verification_status = 'pending_verification'
         AND ddm.team_member_id IN (${placeholders})`,
      [user_id, ...teamMemberIds]
    );

    if (pendingRows.length > 0) {
      await connection.rollback();
      await safeUnlink(tempUploadPath);
      return res.status(409).json({
        error: 'One or more selected workers already have a deployment pending verification.',
      });
    }

    const total_employer_monthly = normalized.reduce((s, l) => s + l.worker_rate, 0);
    const total_platform_fee = normalized.reduce((s, l) => s + l.platform_fee, 0);

    const cloudinaryFolder = `manpower_deployments/${user_id}/${uuidv4()}`;
    let proof_file_url: string;
    try {
      proof_file_url = await uploadToCloudinary(tempUploadPath, cloudinaryFolder);
    } catch (uploadErr: unknown) {
      await connection.rollback();
      await safeUnlink(tempUploadPath);
      logger.error('Deployment proof Cloudinary upload failed', {
        user_id,
        ip,
        name: uploadErr instanceof Error ? uploadErr.name : 'UnknownError',
        message: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
      });
      return res.status(500).json({ error: 'Failed to upload payment proof.' });
    }
    await safeUnlink(tempUploadPath);

    const fallbackName = `receipt-${uuidv4()}`;
    const proof_original_name =
      typeof req.file.originalname === 'string' && req.file.originalname.trim() !== ''
        ? req.file.originalname.trim().slice(0, 255)
        : fallbackName;

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `INSERT INTO manpower_deployment (
        manpower_provider_id, project_name, employer_name, location, start_date, end_date, site_contact,
        total_employer_monthly, total_platform_fee, payment_method, payment_reference,
        proof_file_path, proof_original_name, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification')`,
      [
        user_id,
        project_name,
        employer_name,
        location,
        start_date,
        end_date,
        site_contact,
        total_employer_monthly,
        total_platform_fee,
        payment_method,
        payment_reference,
        proof_file_url,
        proof_original_name,
      ]
    );

    const deployment_id = insertResult.insertId;

    for (const line of normalized) {
      await connection.execute(
        `INSERT INTO manpower_deployment_member (deployment_id, team_member_id, worker_rate, platform_fee)
         VALUES (?, ?, ?, ?)`,
        [deployment_id, line.team_member_id, line.worker_rate, line.platform_fee]
      );
    }

    await connection.execute(
      `UPDATE manpower_team_member
       SET status = 'pending'
       WHERE manpower_provider_id = ? AND team_member_id IN (${placeholders}) AND status = 'available'`,
      [user_id, ...teamMemberIds]
    );

    await connection.commit();

    return res.status(201).json({
      message: 'Deployment submitted successfully.',
      deployment: {
        deployment_id,
        verification_status: 'pending_verification',
        proof_file_path: proof_file_url,
        total_platform_fee,
        total_employer_monthly,
      },
    });
  } catch (error: unknown) {
    await connection?.rollback();
    await safeUnlink(tempUploadPath);
    console.error('[submitDeployment]', error);
    logger.error('Failed to submit deployment', {
      ip,
      user_id,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });
    return res.status(500).json({ error: 'Failed to submit deployment.' });
  } finally {
    if (connection) connection.release();
  }
};

async function safeUnlink(filePath: string | undefined) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    /* ignore */
  }
}
