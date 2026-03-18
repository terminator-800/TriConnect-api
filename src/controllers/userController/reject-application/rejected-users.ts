import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import logger from '../../../config/logger.js';

interface CreateRejectedHireResult {
  success: boolean;
  message: string;
  hire_id?: number;
  rejectedHire?: {
    hire_id: number;
    employer_id: number;
    employee_id: number;
    status: string;
    rejection_reason: string;
    rejected_at: string;
  };
}

interface CreateRejectedHireParams {
  employer_id: number;
  employee_id: number;
  rejection_reason: string;
}

/**
 * Creates a rejected hire record in the hires table
 * @param connection - Database connection
 * @param params - Parameters for creating the rejected hire
 * @returns Result object with success status and created hire details
 */
export const createRejectedHire = async (
  connection: PoolConnection,
  params: CreateRejectedHireParams
): Promise<CreateRejectedHireResult> => {
  const { 
    employer_id, 
    employee_id, 
    rejection_reason
  } = params;

  try {
    // Insert rejected hire record
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO hires (
        employer_id,
        employee_id,
        status,
        rejection_reason,
        rejected_at
      ) VALUES (?, ?, 'rejected', ?, NOW())`,
      [employer_id, employee_id, rejection_reason]
    );

    const hire_id = result.insertId;

    if (!hire_id) {
      return {
        success: false,
        message: 'Failed to create rejected hire record'
      };
    }

    // Fetch the created hire record for confirmation
    const [createdHire] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        hire_id,
        employer_id,
        employee_id,
        status,
        rejection_reason,
        rejected_at
      FROM hires
      WHERE hire_id = ?`,
      [hire_id]
    );

    if (createdHire.length === 0) {
      return {
        success: false,
        message: 'Hire record created but could not be retrieved'
      };
    }

    const hire = createdHire[0]!;

    return {
      success: true,
      message: 'Rejected hire record created successfully',
      hire_id: hire.hire_id,
      rejectedHire: {
        hire_id: hire.hire_id,
        employer_id: hire.employer_id,
        employee_id: hire.employee_id,
        status: hire.status,
        rejection_reason: hire.rejection_reason,
        rejected_at: hire.rejected_at
      }
    };

  } catch (error) {
    console.error('Error creating rejected hire record:', error);
    throw new Error('Failed to create rejected hire record');
  }
};

interface RejectedHireResult {
  isRejected: boolean;
  hire_id?: number;
  rejection_reason?: string | null;
  rejected_at?: Date | null;
  job_title?: string | null;
  start_date?: Date | null;
  end_date?: Date | null;
    status?: string | null;
}

// 
export const hiresRecord = async (
  connection: PoolConnection,
  employer_id: number,
  employee_id: number
): Promise<RejectedHireResult> => {
  try {
    const [rows] = await connection.query<RowDataPacket[]>(
      `
      SELECT 
        hire_id,
        job_title,
        rejection_reason,
        start_date,
        end_date,
        rejected_at,
        status
      FROM hires
      WHERE employer_id = ?
        AND employee_id = ?
        AND status = 'rejected'
      ORDER BY rejected_at DESC
      LIMIT 1
      `,
      [employer_id, employee_id]
    );

    if (rows.length === 0) {
      return { isRejected: false };
    }

    const row = rows[0] as {
      hire_id: number;
      job_title: string | null;
      rejection_reason: string | null;
      rejected_at: Date | null;
      start_date: Date | null;
      end_date: Date | null;
      status: string | null;
    };

    return {
      isRejected: true,
      hire_id: row.hire_id,
      rejection_reason: row.rejection_reason,
      rejected_at: row.rejected_at,
      job_title: row.job_title,
      start_date: row.start_date,
      end_date: row.end_date,
      status: row.status, 
    };
  } catch (error: any) {
    logger.error('Error checking for rejected hire', {
      employer_id,
      employee_id,
      error: error?.message,
      stack: error?.stack,
    });
    throw error;
  }
};