import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { ROLE } from '../utils/roles.js';

class UserRepository {

  async getDisplayName(connection: PoolConnection, user_id: number): Promise<string> {
    const [userRows] = await connection.execute<RowDataPacket[]>(
      `SELECT role FROM users WHERE user_id = ?`,
      [user_id]
    );

    if (userRows.length === 0 || !userRows[0]?.role) {
      throw new Error(`User not found for user ID ${user_id}`);
    }

    const role = userRows[0].role as string;

    switch (role) {
      case ROLE.JOBSEEKER: {
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT full_name FROM jobseeker WHERE jobseeker_id = ?`,
          [user_id]
        );
        if (rows.length === 0 || !rows[0]?.full_name) throw new Error('Jobseeker profile not found.');
        return rows[0].full_name as string;
      }

      case ROLE.BUSINESS_EMPLOYER: {
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT business_name FROM business_employer WHERE business_employer_id = ?`,
          [user_id]
        );
        if (rows.length === 0 || !rows[0]?.business_name) throw new Error('Business employer profile not found.');
        return rows[0].business_name as string;
      }

      case ROLE.INDIVIDUAL_EMPLOYER: {
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT full_name FROM individual_employer WHERE individual_employer_id = ?`,
          [user_id]
        );
        if (rows.length === 0 || !rows[0]?.full_name) throw new Error('Individual employer profile not found.');
        return rows[0].full_name as string;
      }

      case ROLE.MANPOWER_PROVIDER: {
        const [rows] = await connection.execute<RowDataPacket[]>(
          `SELECT agency_name FROM manpower_provider WHERE manpower_provider_id = ?`,
          [user_id]
        );
        if (rows.length === 0 || !rows[0]?.agency_name) throw new Error('Manpower provider profile not found.');
        return rows[0].agency_name as string;
      }

      default:
        throw new Error(`Unsupported role: ${role}`);
    }
  }

}

export const userRepository = new UserRepository();