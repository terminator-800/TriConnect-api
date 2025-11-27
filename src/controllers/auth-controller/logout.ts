import type { Request, Response, RequestHandler } from "express";
import type { AuthenticatedUser } from "../../types/express/auth.js";
import logger from "../../config/logger.js";

interface AuthRequest extends Request {
    user?: AuthenticatedUser;
}

export const logout: RequestHandler = async (request: AuthRequest, response: Response) => {
    try {

        response.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            path: "/",
        });

        logger.info(`User logged out: (User email: ${request.user?.email}) (User ID: ${request.user?.user_id}) (User Role: ${request.user?.role})`);
        return response.status(200).json({
            message: "Logged out successfully",
            clearLocalStorage: true,
        });
    } catch (error: any) {
        logger.error("Logout failed", {
            error: error,
            name: error?.name || "UnknownError",
            message: error?.message || "No message",
            stack: error?.stack || "No stack trace",
            cause: error?.cause || "No cause",
            user_email: request.user?.email,
            user_id: request.user?.user_id,
            user_role: request.user?.role,
            ip: request.ip
        });
        return response.status(500).send("Logout failed");
    }
};
