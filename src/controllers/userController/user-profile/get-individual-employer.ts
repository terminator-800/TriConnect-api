import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { format } from "date-fns";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";

export interface IndividualEmployerProfile {
    user_id: number;
    full_name: string;
    gender: string;
    phone: string;
    date_of_birth: string | null;
    present_address: string;
    permanent_address: string;
    email: string;
    is_verified: boolean | number;
    is_submitted: boolean | number;
    is_rejected: boolean | number;
    account_status: string;
    role: typeof ROLE.INDIVIDUAL_EMPLOYER;
    profile?: string | null;
}

export async function getIndividualEmployerProfile(connection: PoolConnection, user_id: number): Promise<IndividualEmployerProfile | null> {
    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `
      SELECT 
        i.individual_employer_id AS user_id,
        i.full_name,
        i.gender,
        i.phone,
        i.date_of_birth,
        i.present_address,
        i.permanent_address,
        u.email,
        u.is_verified,
        u.is_submitted,
        u.is_rejected,
        u.account_status,
        u.profile
      FROM individual_employer i
      JOIN users u ON i.individual_employer_id = u.user_id
      WHERE i.individual_employer_id = ?
      `,
            [user_id]
        );

        const row = rows[0];
        if (!row) return null;

        const profile: IndividualEmployerProfile = {
            user_id: row.user_id,
            full_name: row.full_name,
            gender: row.gender,
            phone: row.phone,
            present_address: row.present_address,
            permanent_address: row.permanent_address,
            email: row.email,
            is_verified: row.is_verified,
            is_submitted: row.is_submitted,
            is_rejected: row.is_rejected,
            account_status: row.account_status,
            date_of_birth: row.date_of_birth
                ? format(new Date(row.date_of_birth), "MMMM dd, yyyy 'at' hh:mm a")
                : null,
            role: ROLE.INDIVIDUAL_EMPLOYER,
            profile: row.profile || null
        };

        return profile;
    } catch (error) {
        throw error;
    }
}
