import type { PoolConnection } from 'mysql2/promise';
import { findOrCreateAdmin } from './find-create-administrator.js'
import logger from "../../../config/logger.js";
import bcrypt from 'bcrypt';
import pool from "../../../config/database-connection.js";

export const createAdministrator = async (): Promise<{ success: boolean; message: string }> => {
    let connection: PoolConnection | undefined;


    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
        logger.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables", {
            ADMIN_EMAIL: adminEmail ? "SET" : "MISSING",
            ADMIN_PASSWORD: adminPassword ? "SET" : "MISSING",
        });
        throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables');
    }

    try {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        connection = await pool.getConnection();
        const result = await findOrCreateAdmin(connection, { email: adminEmail, hashedPassword });

        if (result.alreadyExists) {
            return {
                success: true,
                message: "Administrator account already exists"
            };
        } else {
            return {
                success: true,
                message: "Administrator account created successfully"
            };
        }
    } catch (error: any) {
        logger.error("Failed to create administrator at (create-administrator)", {
            name: error?.name || "UnknownError",
            message: error?.message || "No message",
            stack: error?.stack || "No stack trace",
            cause: error?.cause || "No cause",
            adminEmail
        });
        return {
            success: false,
            message: "Failed to create administrator"
        };
    } finally {
        if (connection) connection.release();
    }
};



