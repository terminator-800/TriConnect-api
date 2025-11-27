import mysql, { type Pool } from 'mysql2/promise';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

dotenv.config();

let pool: Pool;

try {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
        logger.error("Missing database environment variables", {
            DB_HOST: process.env.DB_HOST,
            DB_USER: process.env.DB_USER,
            DB_PASSWORD: process.env.DB_PASSWORD ? "SET" : "MISSING",
            DB_NAME: process.env.DB_NAME
        });
        throw new Error("Database environment variables are missing");
    }

    pool = mysql.createPool({
        host: process.env.DB_HOST!,
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        database: process.env.DB_NAME!,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    });

    logger.info("Database pool created successfully");

} catch (error: any) {
    logger.error("Failed to create database pool", {
        name: error?.name || "UnknownError",
        message: error?.message || "Unknown error",
        stack: error?.stack || "No stack trace",
        error, 
    });
    throw error;
}

// Optional: listen for runtime pool errors
pool.on('connection', (connection) => {
    logger.debug(`New connection established with ID: ${connection.threadId}`);
});

pool.on('enqueue', () => {
    logger.warn("Waiting for available database connection...");
});

export default pool;
