import { getUserProfile, updateUserProfile, deleteLocalTempFile } from './helper.js'
import type { AuthenticatedRequest } from '../../../middleware/authenticate.js';
import { extractPublicIdFromUrl } from "../../../service/extract-public-id-url.js";
import { deleteFromCloudinary } from "../../../utils/delete-from-cloudinary.js";
import { uploadToCloudinary } from "../../../utils/upload-to-cloudinary.js";
import type { Response } from "express";
import { ROLE } from '../../../utils/roles.js';
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";

const allowedRoles: typeof ROLE[keyof typeof ROLE][] = [
    ROLE.JOBSEEKER,
    ROLE.MANPOWER_PROVIDER,
    ROLE.INDIVIDUAL_EMPLOYER,
    ROLE.BUSINESS_EMPLOYER
];

export const changeProfile = async (req: AuthenticatedRequest, res: Response) => {
    const connection = await pool.getConnection();
    const ip = req.ip;

    try {
        const user_id = req.user?.user_id;
        const role = req.user?.role

        if (!user_id || !role) {
            logger.warn("Unauthorized role tried to changing profile", { user_id, role, ip });
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!allowedRoles.includes(role as typeof ROLE[keyof typeof ROLE])) {
            logger.warn("Unauthorized role tried to changing the profile", { user_id, role, ip });
            return res.status(403).json({ error: "Forbidden: Only authorized users can change profile." });
        }

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        logger.info("Uploaded profile image", {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            filename: req.file.filename,
            path: req.file.path,
        });

        const cloudinaryUrl = await uploadToCloudinary(req.file.path, "user_profiles");

        // 2️⃣ Get old profile from DB
        const oldProfileUrl = await getUserProfile(connection, user_id);

        // 3️⃣ Delete old profile from Cloudinary if exists
        const oldPublicId = extractPublicIdFromUrl(oldProfileUrl);
        if (oldPublicId) {
            await deleteFromCloudinary(oldPublicId);
        }

        // 4️⃣ Save new Cloudinary URL in DB
        await updateUserProfile(connection, user_id, cloudinaryUrl);

        // 5️⃣ Delete temp file from local storage
        deleteLocalTempFile(req.file.path);

        res.status(200).json({
            message: "Profile picture updated successfully",
            profile: cloudinaryUrl,
        });
    } catch (error: any) {
        logger.error("Error in changeProfile", {
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
            cause: error?.cause,
            ip,
        });
        res.status(500).json({ message: "Failed to update profile picture" });
    } finally {
        if (connection) connection.release();
    }
};
