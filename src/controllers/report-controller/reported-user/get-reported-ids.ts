import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import logger from "../../../config/logger.js";

// Define ReportedUser here
export interface ReportedUser {
    report_id: number;
    reported_user_id: number;
    reported_by: number;
    reason: string;
    message?: string;
    conversation_id?: number;
    created_at: string;
}

export async function getReportedUsersById(
    connection: PoolConnection,
    reportedBy: number
): Promise<ReportedUser[]> {
    try {
        const [rows] = await connection.execute<RowDataPacket[]>(
            `SELECT * FROM reports WHERE reported_by = ?`,
            [reportedBy]
        );
        return rows as ReportedUser[];
    } catch (error) {
        logger.error("Error fetching reported users by ID", {
            error,
            reportedBy,
        });
        throw new Error("Failed to fetch reported users.");
    }
}
