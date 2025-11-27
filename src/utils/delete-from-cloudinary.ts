import cloudinary from "../config/cloudinary.js";
import logger from "../config/logger.js";

export const deleteFromCloudinary = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info(`Successfully deleted Cloudinary file: ${publicId}`, { result });

    return result;
  } catch (error: any) {
    logger.error("Failed to delete Cloudinary file", {
      publicId,
      name: error?.name || "UnknownError",
      message: error?.message || "Unknown error",
      stack: error?.stack || "No stack trace",
      cause: error?.cause || "No cause",
      error,
    });
    throw new Error("Failed to delete file from Cloudinary.");
  }
};
