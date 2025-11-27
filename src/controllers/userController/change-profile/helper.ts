import logger from "../../../config/logger.js";
import fs from "fs";

// === DB Helpers ===
export async function getUserProfile(connection: any, user_id: number): Promise<string | null> {
    const [rows] = await connection.execute(
        "SELECT profile FROM users WHERE user_id = ?",
        [user_id]
    );
    return (rows as any)[0]?.profile || null;
}

export async function updateUserProfile(connection: any, user_id: number, profileUrl: string) {
    await connection.execute(
        "UPDATE users SET profile = ? WHERE user_id = ?",
        [profileUrl, user_id]
    );
}

// === File Helpers ===
export function deleteLocalTempFile(path: string) {
    fs.unlink(path, (err) => {
        if (err) logger.warn("Failed to delete temp file", { error: err });
    });
}