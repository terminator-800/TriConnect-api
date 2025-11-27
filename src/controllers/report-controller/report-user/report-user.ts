import type { AuthenticatedUser } from "../../../types/express/auth.js";
import type { Request, Response } from "express";
import type { PoolConnection } from "mysql2/promise";
import { findExistingReport } from "./find-existing-report.js";
import { uploadToCloudinary } from "../../../utils/upload-to-cloudinary.js";
import { insertNewReport } from "./insert-new-report.js";
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";

interface ReportUserRequest extends Request {
    user?: AuthenticatedUser;
    files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined;
    tempFolderId?: string;
}

interface ReportUserBody {
    reason: string;
    message?: string;
    reportedUserId: number;
    conversationId?: number;
}

export const reportUser = async (req: ReportUserRequest, res: Response) => {
    let connection: PoolConnection | null = null;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const { reason, message, reportedUserId, conversationId } =
            req.body as ReportUserBody;

        const reportedBy = req.user?.user_id;

        // Flatten files from req.files
        const filesRaw = req.files;
        let files: Express.Multer.File[] = [];

        if (Array.isArray(filesRaw)) {
            files = filesRaw;
        } else if (filesRaw && typeof filesRaw === 'object') {
            files = Object.values(filesRaw).flat();
        }

        if (!reportedBy || !reportedUserId || !reason) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        const existing = await findExistingReport(
            connection,
            reportedBy,
            reportedUserId
        );

        if (existing.length > 0) {
            return res
                .status(409)
                .json({ error: "You have already reported this user." });
        }

        // Insert new report entry
        const reportId: number = await insertNewReport(
            connection,
            reportedBy,
            reportedUserId,
            reason,
            message,
            conversationId
        );

        // Upload files to Cloudinary and insert into DB
        if (files.length > 0) {
            await Promise.all(
                files.map(async (file) => {
                    const secureUrl = await uploadToCloudinary(file.path, `reports/${reportId}`);
                    const fileType = file.mimetype.startsWith('image/') ? 'image' : 'file';
                    await connection?.query(
                        `INSERT INTO report_proofs (report_id, file_url, file_type) VALUES (?, ?, ?)`,
                        [reportId, secureUrl, fileType]
                    );
                })
            );
        }

        await connection.commit();
        res.status(200).json({ message: "Report submitted successfully." });
    } catch (error) {

        if (connection) {
            try {
                await connection.rollback();
            } catch (error) {
                logger.error("Failed to rollback transaction", { error });
            }
        }

        logger.error("Failed to submit report", {
            error,
            user_id: req.user?.user_id,
            body: req.body,
            filesCount: req.files ? (Array.isArray(req.files) ? req.files.length : Object.values(req.files).flat().length) : 0
        });

        res.status(500).json({ error: "Failed to submit report." });
    } finally {
        if (connection) {
            try {
                connection.release();
            } catch (releaseError) {
                logger.error("Failed to release DB connection", { error: releaseError });
            }
        }
    }
};
