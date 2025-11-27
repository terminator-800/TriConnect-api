import { validateUserId, validateAdminRole, restrictUserInDB } from "./restrict-user-helper.js";
import type { CustomRequest } from "../../../types/express/auth.js";
import type { PoolConnection } from "mysql2/promise";
import type { Response } from "express";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";

interface RestrictUserBody {
    user_id: string | number;
    reason?: string;
}

export const restrictUser = async (req: CustomRequest, res: Response): Promise<void> => {
    let connection: PoolConnection | undefined;

    if (req.user?.role !== ROLE.ADMINISTRATOR) {
        logger.warn(`User ${req.user?.user_id} attempted to restrict a user without admin rights`);
        res.status(403).json({ error: "Forbidden: Admins only." });
        return;
    }

    try {
        const { user_id, reason } = req.body as RestrictUserBody;

        validateUserId(user_id);
        validateAdminRole(req.user);

        connection = await pool.getConnection();
        await connection.beginTransaction();

        await restrictUserInDB(connection, user_id, reason);

        await connection.commit();

        logger.info(`User ${user_id} restricted in DB. Reason: ${reason || 'N/A'}`);

        res.json({
            message: 'User restricted successfully',
            user_id,
            new_status: 'restricted'
        });
    } catch (error: any) {

        if (connection) await connection.rollback();
        logger.error(`Failed to restrict user at (restrict-user): ${req.body.user_id}`, {
            user_id: req.user_id,
            ip: req.ip,
            message: error?.message || "Unknown error",
            stack: error?.stack || "No stack trace",
            name: error?.name || "UnknownError",
            cause: error?.cause || "No cause",
            error,
        });
        res.status(500).json({
            message: 'Failed to restrict user'
        });
    } finally {
        if (connection) connection.release();
    }
};
