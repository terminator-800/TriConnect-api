import type { RowDataPacket } from "mysql2/promise";

export interface AdminData {
    email: string,
    hashedPassword: string;
}

export interface User extends RowDataPacket {
    user_id: number;
    email: string;
    password: string;
    role: string;
    is_registered: number;
    is_verified: number;
    is_submitted: number;
    verified_at: Date | null;
}

// Define Multer.File locally
export interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
}