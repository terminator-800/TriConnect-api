import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { format } from "date-fns";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";

export interface JobseekerProfile {
    user_id: number;
    full_name: string;
    email: string;
    gender: string;
    phone: string;
    date_of_birth: string;
    is_verified: boolean | number;
    is_submitted: boolean | number;
    is_rejected: boolean | number;
    account_status: string;
    role: typeof ROLE.JOBSEEKER;
    profile?: string | null;

}

export async function getJobseekerProfile(connection: PoolConnection, user_id: number): Promise<JobseekerProfile | null> {
    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `
      SELECT 
        j.jobseeker_id AS user_id,
        j.full_name,
        u.email,
        j.gender,
        j.phone,
        j.date_of_birth,
        u.is_verified,
        u.is_submitted,
        u.is_rejected,
        u.account_status,
        u.profile
      FROM jobseeker j
      JOIN users u ON j.jobseeker_id = u.user_id
      WHERE j.jobseeker_id = ?
      `,
            [user_id]
        );

        const row = rows[0];
        if (!row) return null;

        const profile: JobseekerProfile = {
            user_id: row.user_id,
            full_name: row.full_name,
            email: row.email,
            gender: row.gender,
            phone: row.phone,
            date_of_birth: row.date_of_birth
                ? format(new Date(row.date_of_birth), "MMMM dd, yyyy 'at' hh:mm a")
                : "",
            is_verified: row.is_verified,
            is_submitted: row.is_submitted,
            is_rejected: row.is_rejected,
            account_status: row.account_status,
            role: ROLE.JOBSEEKER,
            profile: row.profile || null
        };

        return profile;
    } catch (error) {
        throw error;
    }
}
