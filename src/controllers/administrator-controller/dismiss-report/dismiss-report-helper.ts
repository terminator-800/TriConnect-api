import type { PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import path from "path";
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import logger from "../../../config/logger.js";

export interface ProofFile extends RowDataPacket {
    file_url: string;
}

/** Delete all proof records for a report */
export async function deleteProofRecords(
    connection: PoolConnection,
    reportId: number
): Promise<void> {
    try {
        const [result] = await connection.query<ResultSetHeader>(
            `DELETE FROM report_proofs WHERE report_id = ?`,
            [reportId]
        );
        logger.info(`Deleted ${result.affectedRows} proof record(s) for report_id: ${reportId}`);
    } catch (error: any) {
        if (error.code && error.code.startsWith("ER_")) {
            logger.error("Database query failed while deleting proof records", { reportId, error });
        } else if (error.code === "ECONNREFUSED") {
            logger.error("Database connection refused while deleting proof records", { reportId, error });
        } else {
            logger.error("Unexpected error while deleting proof records", { reportId, error });
        }
        throw error;
    }
}

/** Delete the report record itself */
export async function deleteReportRecord(
    connection: PoolConnection,
    reportId: number
): Promise<boolean> {
    try {
        const [result] = await connection.query<ResultSetHeader>(
            `DELETE FROM reports WHERE report_id = ?`,
            [reportId]
        );

        if (result.affectedRows > 0) {
            logger.info(`Report deleted successfully for report_id: ${reportId}`);
            return true;
        } else {
            logger.warn(`No report found to delete for report_id: ${reportId}`);
            return false;
        }

    } catch (error: any) {
        if (error.code && error.code.startsWith("ER_")) {
            logger.error("Database query failed while deleting report", { reportId, error });
        } else if (error.code === "ECONNREFUSED") {
            logger.error("Database connection refused while deleting report", { reportId, error });
        } else {
            logger.error("Unexpected error while deleting report", { reportId, error });
        }
        throw error;
    }
}

