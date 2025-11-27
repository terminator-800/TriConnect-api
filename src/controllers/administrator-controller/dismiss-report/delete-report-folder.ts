import cloudinary from "../../../config/cloudinary.js";
import logger from "../../../config/logger.js";

export async function deleteReportInCloudinary(reportId: number | string) {
  const folderPath = `reports/${reportId}`;
  try {
    // Attempt to delete all resources in the folder
    const deleteResourcesResult = await cloudinary.api.delete_resources_by_prefix(folderPath);
    logger.info(`Cloudinary resources deleted for report_id: ${reportId}`, { deleteResourcesResult });

    // Attempt to delete the folder itself
    const deleteFolderResult = await cloudinary.api.delete_folder(folderPath);
    logger.info(`Cloudinary folder deleted for report_id: ${reportId}`, { deleteFolderResult });

  } catch (error: any) {
    // Log specific Cloudinary API errors
    if (error.http_code) {
      logger.error(`Cloudinary API error while deleting report_id: ${reportId}`, {
        errorCode: error.http_code,
        errorMessage: error.message,
        stack: error.stack,
      });
    } else {
      // Fallback for unexpected errors
      logger.error(`Unexpected error while deleting report_id: ${reportId}`, { error });
    }

    throw error;
  }
}
