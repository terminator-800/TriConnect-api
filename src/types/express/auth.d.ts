import type { Request } from 'express';
import { ROLE } from '../utils/roles.js';

export type Role = typeof ROLE[keyof typeof ROLE];

export interface AuthenticatedUser {
    user_id: number;
    email: string;
    role: Role;
    is_registered: boolean | 0 | 1;
}

export interface CustomRequest extends Request {
    user?: AuthenticatedUser;
    files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] } | undefined;
    tempFolderId?: string;
    body: Record<string, any>;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            role: Role;
            user_id: number;
            is_registered: boolean | 0 | 1;
        }
    }
}
