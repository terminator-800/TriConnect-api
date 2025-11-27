import type { AuthenticatedUser } from "../../../types/express/auth.js";
import type { PoolConnection } from "mysql2/promise";

/** Validate that a user ID is provided */
export function validateUserId(user_id: string | number | undefined): asserts user_id {
    if (!user_id) {
        const error = new Error('User ID is required') as Error & { status?: number };
        error.status = 400;
        throw error;
    }
}

/** Ensure only administrators can restrict users */
export function validateAdminRole(user?: AuthenticatedUser): void {
    if (!user || user.role !== 'administrator') {
        const error = new Error('Access denied: Admins only') as Error & { status?: number };
        error.status = 403;
        throw error;
    }
}

/** Restrict a user in the database */
export async function restrictUserInDB(
    connection: PoolConnection,
    user_id: string | number,
    reason?: string
): Promise<void> {
    try {
        await connection.query(
            `UPDATE users 
             SET account_status = 'restricted', 
                 status_reason = ?, 
                 status_updated_at = NOW()
             WHERE user_id = ?`,
            [reason || 'Violation of terms', user_id]
        );
    } catch (error: any) {
        throw error;
    }
}
