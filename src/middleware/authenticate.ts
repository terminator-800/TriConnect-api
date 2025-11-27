import type { Request, Response, NextFunction } from 'express';
import { ROLE } from '../utils/roles.js';
import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

export type Role = typeof ROLE[keyof typeof ROLE];

export interface AuthenticatedUser {
    user_id: number;
    email: string;
    role: Role;
    is_registered: boolean | 0 | 1;
}

// Extend Express Request with `user`
export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}

// Type for expected JWT payload
interface JwtPayload {
    user_id: number;
    email: string;
    role: Role;
    is_registered: boolean | 0 | 1;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let token = req.cookies?.token;

    // Fallback: Check Authorization header (from localStorage in frontend)
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        logger.warn('Unauthorized access attempt: No token provided', { ip: req.ip });
        return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        logger.error('JWT_SECRET is not defined in environment variables');
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    try {
        const decoded = jwt.verify(token, secret) as JwtPayload;

        if (!decoded || !decoded.user_id || !decoded.email || !decoded.role) {
            logger.warn('Invalid token payload', { token, ip: req.ip });
            return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
        }

        req.user = {
            user_id: decoded.user_id,
            email: decoded.email,
            role: decoded.role,
            is_registered: decoded.is_registered,
        };

        next();
    } catch (error: any) {
        logger.error("Token verification failed", {
            ip: req.ip,
            token,
            name: error?.name || "UnknownError",
            message: error?.message || "Unknown error",
            stack: error?.stack || "No stack trace",
            cause: error?.cause || "No cause",
            error,
        });
        res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }
};
