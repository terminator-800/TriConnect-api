import { deleteProofRecords, deleteReportRecord } from './dismiss-report-helper.js';
import { deleteReportInCloudinary } from './delete-report-folder.js';
import type { Request, Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';
import sendMail from '../../../service/email-handler.js';
import { notifyUser } from '../../userController/notification/notify-user.js';

interface DismissReportBody {
  report_id: number | string;
}

export const dismissReport = async (
  req: Request<{}, {}, DismissReportBody>,
  res: Response
): Promise<void> => {
  let connection: PoolConnection | undefined;

  try {
    const { report_id } = req.body;

    if (!report_id) {
      res.status(400).json({ error: 'Report ID is required' });
      return;
    }

    if (req.user?.role !== 'administrator') {
      res.status(403).json({ error: 'Access denied: Administrators only' });
      return;
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Fetch the reported user's ID and email before deleting the report
    const [rows]: any = await connection.execute(
      `SELECT r.reported_user_id, u.email 
       FROM reports r 
       JOIN users u ON r.reported_user_id = u.user_id 
       WHERE r.report_id = ?`,
      [report_id]
    );

    if (rows.length === 0) {
      await connection.rollback();
      connection.release();
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const { reported_user_id, email: reportedUserEmail } = rows[0];

    await deleteProofRecords(connection, Number(report_id));
    const deleted = await deleteReportRecord(connection, Number(report_id));

    if (!deleted) {
      await connection.rollback();
      connection.release();
      res.status(404).json({ error: 'Report not found or already dismissed' });
      return;
    }

    //Push notification and send an email to the restricted user
    const title = 'REPORT DISMISSED';
    const message = `The report filed against you has been reviewed and dismissed.`;
    const type = 'report';

    const to = reportedUserEmail;
    const subject = 'Report Dismissal Notice';
    const html = `<p>Dear User,</p><p>${message}</p><p>Your account remains in good standing.</p>`;

    await Promise.all([
      sendMail(to, subject, html),
      notifyUser(Number(reported_user_id), title, message, type),
    ]);
    await connection.commit();
    connection.release();

    try {
      await deleteReportInCloudinary(report_id);
      logger.info(`Cloudinary files deleted successfully for report_id: ${report_id}`);
    } catch (cloudError: any) {
      logger.error(`Failed to delete Cloudinary files for report_id: ${report_id}`, { cloudError });
    }

    res.status(200).json({ message: 'Report dismissed and files deleted', report_id });
  } catch (error: any) {
    if (connection) await connection.rollback();
    logger.error('Failed to dismiss report at (dismiss-report)', {
      user_id: req.user_id,
      ip: req.ip,
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      name: error?.name || 'UnknownError',
      cause: error?.cause || 'No cause',
      error,
    });
    res.status(500).json({ error: 'Failed to dismiss report' });
  } finally {
    if (connection) connection.release();
  }
};
