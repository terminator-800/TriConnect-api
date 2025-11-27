import logger from "../config/logger.js";

export function extractPublicIdFromUrl(url: string | null): string | null {
  if (!url) {
    logger.warn(`extractPublicIdFromUrl called with null or empty URL`);
    return null;
  }

  try {
    const regex = /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/;
    const match = url.match(regex);

    if (!match || !match[1]) {
      logger.warn(`Failed to extract publicId from URL: ${url}`);
      return null;
      
    }

    return match[1];
  } catch (error: any) {
    throw error;
  }
}