import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import logger from "../../../config/logger.js";

// Define the return type for each agency
export interface UncontactedAgency extends RowDataPacket {
  user_id: number;
  email: string;
  is_verified: boolean | 0 | 1;
  profile: string | null;
  agency_name: string;
  agency_address: string;
  agency_services: string;
}

/**
 * Fetch uncontacted agencies for a given user.
 * @param connection MySQL PoolConnection
 * @param userId ID of the current user
 * @returns Array of UncontactedAgency
 */

export const getUncontactedAgencies = async (
  connection: PoolConnection,
  userId: number
): Promise<UncontactedAgency[]> => {
  try {
    if (!connection) {
      throw new Error("Database connection is undefined");
    }

    if (!Number.isFinite(userId)) {
      throw new Error("Invalid userId provided");
    }

    const [rows] = await connection.execute<UncontactedAgency[]>(
      `
    SELECT u.user_id, u.email, u.is_verified, u.profile,
           mp.agency_name, mp.agency_address, mp.agency_services
    FROM users u
    JOIN manpower_provider mp ON u.user_id = mp.manpower_provider_id
    LEFT JOIN conversations c 
      ON (
        (c.user1_id = ? AND c.user2_id = u.user_id)
        OR (c.user2_id = ? AND c.user1_id = u.user_id)
      )
    WHERE u.role = 'manpower-provider' AND c.conversation_id IS NULL
    `,
      [userId, userId]
    );

    if (!Array.isArray(rows)) {
      throw new Error("Unexpected result from database query");
    }

    return rows;
  } catch (error) {
    throw error;
  }
};
