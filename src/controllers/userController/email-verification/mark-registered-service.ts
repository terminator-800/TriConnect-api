import type { PoolConnection } from "mysql2/promise";
import logger from "../../../config/logger.js";

export async function markRegistered(connection: PoolConnection, email: string): Promise<void> {
    try {
        await connection.execute(
            "UPDATE users SET is_registered = ? WHERE email = ?",
            [1, email]
        );
    } catch (error: unknown) {
        throw new Error("Database error while marking user as registered");
    }
}
