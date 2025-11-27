import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";

export interface ManpowerProviderProfile {
    user_id: number;
    agency_name: string;
    agency_address: string;
    agency_services?: string | null;
    agency_authorized_person: string;
    email: string;
    is_verified: boolean | number;
    is_submitted: boolean | number;
    is_rejected: boolean | number;
    account_status: string;
    role: typeof ROLE.MANPOWER_PROVIDER;
    profile?: string | null;
}

export async function getManpowerProviderProfile(connection: PoolConnection, user_id: number): Promise<ManpowerProviderProfile | null> {
    try {
        const [rows] = await connection.query<RowDataPacket[]>(
            `
      SELECT 
        m.manpower_provider_id AS user_id,
        m.agency_name,
        m.agency_address,
        m.agency_services,
        m.agency_authorized_person,
        u.email,
        u.is_verified,
        u.is_submitted,
        u.is_rejected,
        u.account_status,
        u.profile
      FROM manpower_provider m
      JOIN users u ON m.manpower_provider_id = u.user_id
      WHERE m.manpower_provider_id = ?
      `,
            [user_id]
        );

        const row = rows[0];
        if (!row) return null;

        const profile: ManpowerProviderProfile = {
            user_id: row.user_id,
            agency_name: row.agency_name,
            agency_address: row.agency_address,
            agency_services: row.agency_services ?? null,
            agency_authorized_person: row.agency_authorized_person,
            email: row.email,
            is_verified: row.is_verified,
            is_submitted: row.is_submitted,
            is_rejected: row.is_rejected,
            account_status: row.account_status,
            role: ROLE.MANPOWER_PROVIDER,
            profile: row.profile || null
        };

        return profile;
    } catch (error) {
        throw error;
    }
}
