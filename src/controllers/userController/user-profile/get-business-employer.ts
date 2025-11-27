import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";

export interface BusinessEmployerProfile {
    user_id: number;
    business_name: string;
    industry: string;
    business_address: string;
    business_size: string;
    authorized_person: string;
    email: string;
    is_verified: boolean | number;
    is_submitted: boolean | number;
    is_rejected: boolean | number;
    account_status: string;
    role: typeof ROLE.BUSINESS_EMPLOYER;
    profile?: string | null;

}

export async function getBusinessEmployerProfile(connection: PoolConnection, user_id: number): Promise<BusinessEmployerProfile | null> {
    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `
      SELECT 
        b.business_employer_id AS user_id,
        b.business_name,
        b.industry,
        b.business_address,
        b.business_size,
        b.authorized_person,
        u.email,
        u.is_verified,
        u.is_submitted,
        u.is_rejected,
        u.account_status,
        u.profile
      FROM business_employer b
      JOIN users u ON b.business_employer_id = u.user_id
      WHERE b.business_employer_id = ?
      `,
            [user_id]
        );

        const row = rows[0];
        if (!row) return null;

        const profile: BusinessEmployerProfile = {
            user_id: row.user_id,
            business_name: row.business_name,
            industry: row.industry,
            business_address: row.business_address,
            business_size: row.business_size,
            authorized_person: row.authorized_person,
            email: row.email,
            is_verified: row.is_verified,
            is_submitted: row.is_submitted,
            is_rejected: row.is_rejected,
            account_status: row.account_status,
            role: ROLE.BUSINESS_EMPLOYER,
            profile: row.profile || null
        };

        return profile;
    } catch (error) {
        throw error;
    }
}
