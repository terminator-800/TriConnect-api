import { insertUser, insertJobseeker, insertBusinessEmployer, insertIndividualEmployer, insertManpowerProvider } from "./create-user-helper.js";
import type { PoolConnection } from "mysql2/promise";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";

type RoleType = keyof typeof ROLE;

interface CreateUserSuccess {
    success: true;
    user_id: number;
}

interface CreateUserFailure {
    success: false;
    error: unknown;
}

type CreateUserResult = CreateUserSuccess | CreateUserFailure;

export async function createUsers(connection: PoolConnection, email: string, hashedPassword: string, role: string): Promise<CreateUserResult> {
    try {
        const userId = await insertUser(connection, email, hashedPassword, role);

        switch (role) {
            case ROLE.JOBSEEKER:
                await insertJobseeker(connection, userId);
                break;

            case ROLE.BUSINESS_EMPLOYER:
                await insertBusinessEmployer(connection, userId);
                break;

            case ROLE.INDIVIDUAL_EMPLOYER:
                await insertIndividualEmployer(connection, userId);
                break;

            case ROLE.MANPOWER_PROVIDER:
                await insertManpowerProvider(connection, userId);
                break;

            default:
                throw new Error("Unsupported role type.");
        }

        return { success: true, user_id: userId };
    } catch (error) {
        logger.error("Error creating user", { error, email, role });
        return { success: false, error };
    }
}
