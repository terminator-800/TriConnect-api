import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import logger from "../../../config/logger.js";

export async function findExistingReport(
    connection: PoolConnection,
    reportedBy: number,
    reportedUserId: number
): Promise<RowDataPacket[]> {
    try {
        const [existing] = await connection.query<RowDataPacket[]>(
            `SELECT 1 FROM reports WHERE reported_by = ? AND reported_user_id = ?`,
            [reportedBy, reportedUserId]
        );

        return existing;
    } catch (error) {
        logger.error("Failed to check existing report", {
            error,
            reportedBy,
            reportedUserId,
        });
        throw error;
    }
}
