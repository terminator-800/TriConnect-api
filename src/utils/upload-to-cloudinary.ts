import cloudinary from "../config/cloudinary.js"
import logger from "../config/logger.js";

export const uploadToCloudinary = async (filePath: string, folder: string = "user_requirements") => {
    try {
        const result = await cloudinary.uploader.upload(filePath, { folder });
        logger.info(`File uploaded to Cloudinary: ${filePath}`, { folder, url: result.secure_url });
        return result.secure_url;
    } catch (error: any) {
        logger.error("Failed to upload file to Cloudinary", {
            filePath,
            folder,
            name: error?.name || "UnknownError",
            message: error?.message || "Unknown error",
            stack: error?.stack || "No stack trace",
            cause: error?.cause || "No cause",
            error, 
        });
        throw new Error(`Failed to upload file to Cloudinary.`);
    }
};
