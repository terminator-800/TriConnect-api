import type { PoolConnection, ResultSetHeader } from "mysql2/promise";

export const insertUser = async (connection: PoolConnection, email: string, hashedPassword: string, role: string): Promise<number> => {
    const [result] = await connection.execute<ResultSetHeader>(
        "INSERT INTO users (email, password, role) VALUES (?, ?, ?)",
        [email, hashedPassword, role]
    );
    return result.insertId;
};

export const insertJobseeker = async (connection: PoolConnection, userId: number): Promise <void> => {
    await connection.execute<ResultSetHeader>(
        "INSERT INTO jobseeker (jobseeker_id) VALUES (?)",
        [userId]
    );
};

export const insertBusinessEmployer = async (connection: PoolConnection, userId: number): Promise <void> => {
    await connection.execute<ResultSetHeader>(
        "INSERT INTO business_employer (business_employer_id) VALUES (?)",
        [userId]
    );
};

export const insertIndividualEmployer = async (connection: PoolConnection, userId: number): Promise <void>  => {
    await connection.execute<ResultSetHeader>(
        "INSERT INTO individual_employer (individual_employer_id) VALUES (?)",
        [userId]
    );
};

export const insertManpowerProvider = async (connection: PoolConnection, userId: number): Promise <void>  => {
    await connection.execute<ResultSetHeader>(
        "INSERT INTO manpower_provider (manpower_provider_id) VALUES (?)",
        [userId]
    );
};

