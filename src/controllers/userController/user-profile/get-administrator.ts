import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";

export interface AdministratorProfile {
    user_id: number;
    email: string;
    is_verified: boolean | number;
    is_submitted: boolean | number;
    is_rejected: boolean | number;
    account_status: string;
    role: typeof ROLE.ADMINISTRATOR;
}

export async function getAdministratorProfile(connection: PoolConnection, user_id: number): Promise<AdministratorProfile | null> {
    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `
      SELECT 
        u.user_id,
        u.email,
        u.role,
        u.is_verified,
        u.is_submitted,
        u.is_rejected,
        u.account_status
      FROM users u
      WHERE u.user_id = ? AND u.role = 'administrator'
      `,
            [user_id]
        );

        const row = rows[0];
        if (!row) return null;

        const profile: AdministratorProfile = {
            user_id: row.user_id,
            email: row.email,
            role: ROLE.ADMINISTRATOR,
            is_verified: row.is_verified,
            is_submitted: row.is_submitted,
            is_rejected: row.is_rejected,
            account_status: row.account_status,
        };

        return profile;
    } catch (error) {
        throw error;
    }
}
