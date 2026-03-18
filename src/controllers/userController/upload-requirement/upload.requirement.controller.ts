// upload-requirement.controller.ts
// SRP: Only orchestrates the HTTP request/response cycle
// DIP: Depends on abstractions (registry, service, repository) — not concrete file-upload logic

import type { Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import type { CustomRequest } from '../../../types/express/auth.js';

import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';
import { insertUserRequirement, type Payload } from './insert-requirement.js';
import { notificationService } from '../../../service/notification.service.js';
import { userRepository } from '../../../repositories/user.repositories.js';
import { getPayloadBuilder, isAllowedRole } from './payload-builder-registry.js';

interface MulterFiles {
  [fieldname: string]: Express.Multer.File[];
}

export const uploadRequirement = async (req: CustomRequest, res: Response) => {
  const ip = req.ip;
  const { user_id, role } = req.user!;

  // ── 1. Role guard ────────────────────────────────────────────────────────────
  if (!isAllowedRole(role)) {
    logger.warn('Unauthorized role attempted to upload requirement', { role, user_id, ip });
    return res.status(403).json({ message: 'Unauthorized role' });
  }

  // ── 2. Build role-specific payload ───────────────────────────────────────────
  const builder = getPayloadBuilder(role)!;
  const files = req.files as MulterFiles;

  let rolePayload: Record<string, any>;
  try {
    rolePayload = await builder.build(req.body, files);
  } catch (uploadError: any) {
    logger.error('File upload to Cloudinary failed', { uploadError, user_id, ip });
    console.log(`File upload failed for user ID ${user_id}:`, uploadError);;
    return res.status(502).json({ message: 'File upload failed. Please try again.' });
  }

  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await insertUserRequirement(connection, { user_id, role, ...rolePayload } as Payload);

    const notifierName = await userRepository.getDisplayName(connection, user_id);

    await connection.commit();
    connection.release();
    connection = undefined;

    notificationService.notifyAdminOfUpload(user_id, notifierName).catch((error) => {
      logger.error('Failed to send admin notification after requirement upload', {
        error,
        user_id,
        ip,
      });
      console.log(`Failed to send admin notification for requirement upload by user ID ${user_id}:`, error);
    });

    return res.status(200).json({ message: `${role} requirements uploaded successfully` });

  } catch (error: any) {
    await connection?.rollback();
    logger.error('Failed to persist requirement upload', { error, user_id, ip });
    console.log(`Failed to persist requirement upload for user ID ${user_id}:`, error);
    return res.status(500).json({ message: 'Server error' });
  } finally {
    if (connection) connection.release();
  }
};