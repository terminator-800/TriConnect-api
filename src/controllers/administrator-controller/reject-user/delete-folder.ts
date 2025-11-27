import { type Role } from "./reject-user-helper.js";
import fs from "fs/promises";
import path from "path";
import logger from "../../../config/logger.js";

// Base uploads folder
const UPLOADS_BASE = path.join(
    "C:", "Users", "denne", "OneDrive", "Desktop", "TriConnect-1.2", "backend", "uploads"
);

/**
 * Deletes physical files and user folders
 * @param role Role of the user
 * @param userId user_id from DB
 * @param name display name (optional)
 * @param files Array of full relative file paths (from DB)
 */
export async function deleteUserFilesAndFolders(
    role: Role,
    userId: number,
    name: string | undefined,
    files: (string | undefined)[]
): Promise<void> {


    // Delete each file using its full relative path
    for (const file of files) {
        if (!file) continue;

        const fullPath = path.join(UPLOADS_BASE, file.replace(/^uploads[\\/]/, ""));
        try {
            await fs.unlink(fullPath);
            logger.info(`Deleted file: ${fullPath} for user ${userId}`, { role });

        } catch (err: any) {
            logger.error(`Failed to delete file: ${fullPath} for user ${userId}`, { role, error: err });
        }
    }

    // Delete the displayName subfolder if provided
    if (name) {
        const safeName = name.replace(/[^a-zA-Z0-9 _.-]/g, "").trim();
        const folderPath = path.join(UPLOADS_BASE, role, userId.toString(), safeName);

        try {
            await fs.rm(folderPath, { recursive: true, force: true });
            logger.info(`Deleted folder: ${folderPath} for user ${userId}`, { role });
        } catch (err: any) {
            logger.error(`Failed to delete folder: ${folderPath} for user ${userId}`, { role, error: err });
        }
    }

    // Remove the parent user folder only if empty
    const userFolderPath = path.join(UPLOADS_BASE, role, userId.toString());
    try {
        const remaining = await fs.readdir(userFolderPath);
        if (remaining.length === 0) {
            await fs.rm(userFolderPath, { recursive: true, force: true });
            logger.info(`Deleted empty parent folder: ${userFolderPath} for user ${userId}`, { role });
        }
    } catch (err: any) {
        logger.error(`Failed to clean up user folder: ${userFolderPath} for user ${userId}`, { role, error: err });
    }
}
