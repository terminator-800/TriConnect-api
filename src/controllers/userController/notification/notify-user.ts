import pool from "../../../config/database-connection.js";
import logger from "../../../config/logger.js";

export async function notifyUser(
  user_id: number,            // Who receives the notification
  title: string,
  message: string,
  type: "account_verification" |"system" | "job" | "message" = "system",
  notifier_id: number | null = null // Who triggered the notification (optional)
) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute(
      `INSERT INTO notifications (user_id, notifier_id, title, message, type) VALUES (?, ?, ?, ?, ?)`,
      [user_id, notifier_id, title, message, type]
    );
  } catch (error: any) {
    logger.error("Failed to create notification", { user_id, notifier_id, error });
  } finally {
    if (connection) connection.release();
  }
}
