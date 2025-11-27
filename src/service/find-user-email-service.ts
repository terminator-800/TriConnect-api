import type { PoolConnection } from "mysql2/promise";
import type { User } from "../interface/interface.js";
import logger from "../config/logger.js";

export async function findUsersEmail(
    connection: PoolConnection,
    email: string
): Promise<User | null> {
    try {
        const [rows] = await connection.execute<User[]>(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (!rows || rows.length === 0) {
            logger.info(`No user found with email: ${email}`);
            return null;
        }

        return rows.length > 0 && rows[0] ? rows[0] : null;
    } catch (error: any) {

        if (error.code === "ECONNREFUSED") {
            logger.error("Database connection refused", { error });
        }
        else if (error.code && error.code.startsWith("ER_")) {
            logger.error("Database query failed", { email, error });
        }
        else {
            logger.error("Unexpected error in findUsersEmail", { email, error });
        }
        
        throw error;
    }
}

