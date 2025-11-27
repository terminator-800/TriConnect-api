import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

// Feedback row type
interface FeedbackRow extends RowDataPacket {
  feedback_id: number;
  user_id: number;
  message: string;
  created_at: Date;
}
/**
 * Checks if the user has already submitted feedback.
 */
export async function hasSubmittedFeedback(
  connection: PoolConnection,
  userId: number
): Promise<boolean> {
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT feedback_id FROM feedback WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    return rows.length > 0;
  } catch (error) {
    throw error;
  }
}

/**
 * Saves a new feedback entry and returns the saved feedback row.
 */
export async function saveFeedback(
  connection: PoolConnection,
  userId: number,
  message: string
): Promise<FeedbackRow | null> {
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO feedback (user_id, message) VALUES (?, ?)`,
      [userId, message]
    );

    const insertId = result.insertId;

    const [rows] = await connection.execute<FeedbackRow[]>(
      `SELECT feedback_id, user_id, message, created_at 
       FROM feedback WHERE feedback_id = ?`,
      [insertId]
    );

    return rows[0] || null;
  } catch (error) {
    throw error;
  }
}
