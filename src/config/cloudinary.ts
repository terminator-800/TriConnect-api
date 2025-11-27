import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import logger from '../config/logger.js';
dotenv.config();

try {
    if (!process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET) {
        logger.error("Missing Cloudinary environment variables", {
            CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
            CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
            CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? "SET" : "MISSING"
        });
        throw new Error("Missing Cloudinary environment variables");
    }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
        api_key: process.env.CLOUDINARY_API_KEY!,
        api_secret: process.env.CLOUDINARY_API_SECRET!
    });

    logger.info("Cloudinary configured successfully");

} catch (error: any) {
    logger.error("Cloudinary configuration failed", {
        name: error?.name || "UnknownError",
        message: error?.message || "Unknown error",
        stack: error?.stack || "No stack trace",
        error, 
    });
    throw error; 
}

export default cloudinary;
