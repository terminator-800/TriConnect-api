import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import logger from "../../../config/logger.js";

export async function insertNewReport(
    connection: PoolConnection,
    reportedBy: number,
    reportedUserId: number,
    reason: string,
    message?: string,
    conversationId?: number
): Promise<number> {
    try {
        const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO reports (reported_by, reported_user_id, reason, message, conversation_id)
         VALUES (?, ?, ?, ?, ?)`,
            [reportedBy, reportedUserId, reason, message ?? null, conversationId ?? null]
        );

        return result.insertId;
    } catch (error) {
        logger.error("Failed to insert new report", {
            error,
            reportedBy,
            reportedUserId,
            reason,
            message,
            conversationId,
        });
        throw error;
    }
}
