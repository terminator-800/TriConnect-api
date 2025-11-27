import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { deleteUserFilesAndFolders } from "./delete-folder.js";
import { getRoleConfig, type Role } from "./reject-user-helper.js";
import type { Request, Response } from "express";
import { extractPublicIdFromUrl } from "../../../service/extract-public-id-url.js"
import { deleteFromCloudinary } from "../../../utils/delete-from-cloudinary.js";
import pool from "../../../config/database-connection.js";
import logger from "../../../config/logger.js";
import { getRejectionEmailHTML } from './email-rejection.js'
import { sendUserEmail } from "./email-rejection.js";
import { notifyUser } from '../../userController/notification/notify-user.js'
import { getNotifierCredentials } from '../../userController/notification/get-notified.js'

interface RejectUserParams {
    user_id?: number;
}

interface RejectUserResult {
    success: boolean;
    message: string;
        displayName: string;

}

export const rejectUser = async (req: Request<RejectUserParams>, res: Response): Promise<void> => {
    const user_id: number | undefined = req.params.user_id;

    if (!user_id) {
        logger.warn("Reject user called without user_id parameter");
        res.status(400).json({ message: "user_id parameter is required" });
        return;
    }

    let connection: PoolConnection | undefined;

    try {
        connection = await pool.getConnection();
        const result = await rejectUsers(connection, user_id as number);
        
   
        const [emailRows] = await connection.execute<RowDataPacket[]>(
        `SELECT email FROM users WHERE user_id = ?`,
        [user_id]
        );
        const userEmail = emailRows[0]?.email;

        if (userEmail) {
            await sendUserEmail(
                userEmail,
                "TriConnect Account Rejected",
                getRejectionEmailHTML(result.displayName)
            );
        }            
        
        const displayName =  await getNotifierCredentials(user_id);

        const io = req.app.get("io");
        const userSocketMap = req.app.get("userSocketMap");
        const socketId = userSocketMap[user_id];

        try {
            if (socketId) {
            io.to(socketId).emit("notification", {
                title: "REQUIREMENTS REJECTED",
                message: `Hi ${displayName}, your submitted requirements have been rejected. Please check your email for details and resubmit the correct documents.`,
                type: "account_verification",
                notifier_id: req.user?.user_id,
                created_at: new Date(),
            });
            }
        } catch (socketError) {
            logger.error("Failed to emit socket notification", { user_id, socketError });
        }
        
        await notifyUser(
            Number(user_id),
            "REQUIREMENTS REJECTED",
            `Hi ${displayName}, Your submitted requirements have been rejected. Please check your email for details and resubmit the correct documents.`,
            "account_verification",
            req.user?.user_id ?? null
        ); 
        
        logger.info(`User ${user_id} rejected successfully`);
        res.json({ success: true, message: result.message });
    } catch (error: any) {
        logger.error(`Failed to reject: (User ID: ${user_id}) in reject user`, {
            user_id: req.user_id,
            ip: req.ip,
            message: error?.message || "Unknown error",
            stack: error?.stack || "No stack trace",
            name: error?.name || "UnknownError",
            cause: error?.cause || "No cause",
            error,
        });
        res.status(500).json({ message: "Internal server error." });
    } finally {
        if (connection) connection.release();
    }
};

async function rejectUsers(connection: PoolConnection, user_id: number): Promise<RejectUserResult> {

    try {
        const [userRows] = await connection.execute<RowDataPacket[]>(
            `SELECT role FROM users WHERE user_id = ?`,
            [user_id]
        );

        if (!userRows.length) {
            logger.warn(`User ${user_id} not found in database`);
            throw new Error("User not found.");
        }

        const role: Role = userRows[0]!.role as Role;

        const { table, idField, resetFields, fileFields } = getRoleConfig(role);

        const [existingRows] = await connection.execute<RowDataPacket[]>(
            `SELECT ${resetFields.join(", ")} FROM ${table} WHERE ${idField} = ?`,
            [user_id]
        );

        const existingData: Record<string, any> = existingRows[0] || {};

        let displayName: string;
        switch (role) {
        case "jobseeker":
            displayName = existingData.full_name || "unknown";
            break;
        case "business-employer":
            displayName = existingData.business_name || "unknown";
            break;
        case "individual-employer":
            displayName = existingData.full_name || "unknown";
            break;
        case "manpower-provider":
            displayName = existingData.agency_name || "unknown";
            break;
        default:
            displayName = "unknown";
        }

        // --- Delete files from Cloudinary ---
        for (const field of fileFields) {
            const fileUrl = existingData[field];
            const publicId = extractPublicIdFromUrl(fileUrl);
            if (publicId) {
                try {
                    await deleteFromCloudinary(publicId);
                    logger.info(`Deleted ${field} for user ${user_id} from Cloudinary`, { publicId });
                } catch (error: any) {
                    logger.error(`Failed to delete ${field} from Cloudinary for user ${user_id}`, { error });
                }
            }
        }

        const fileList: string[] =
            fileFields.map((field) => existingData[field]).filter(Boolean);

        // --- Delete local files and folders ---
        try {
            await deleteUserFilesAndFolders(role, user_id, displayName, fileList);
            logger.info(`Deleted local files and folders for user ${user_id}`, { role, files: fileList });
        } catch (fileError: any) {
            logger.error(`Failed to delete local files/folders for user ${user_id}`, { fileError });
        }

        // --- Reset fields in the specific role table ---
        try {
            const resetQuery = `
                UPDATE ${table}
                SET ${resetFields.map((f) => `${f} = NULL`).join(", ")}
                WHERE ${idField} = ?
            `;
            await connection.execute(resetQuery, [user_id]);
            logger.debug(`Reset fields for user ${user_id} in ${table}`, { resetFields });
        } catch (resetError: any) {
            throw resetError;
        }

        // --- Update user status ---
        try {
            const userStatusQuery = `
                UPDATE users
                SET is_verified = false,
                    is_submitted = false,
                    is_rejected = true,
                    verified_at = NULL
                WHERE user_id = ?
            `;
            await connection.execute(userStatusQuery, [user_id]);
            logger.debug(`Updated rejection status for user ${user_id}`);
        } catch (statusError: any) {
            logger.error(`Failed to update rejection status for user ${user_id}`, { statusError });
            throw statusError;
        }

        return {
            success: true,
            message: `${role} requirements rejected, files and folders removed, and rejection recorded.`,
            displayName
        };
    } catch (error) {
        throw error;
    }
}
