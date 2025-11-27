import type { Request, Response } from "express";
import type { PoolConnection } from "mysql2/promise";
import { processSeenMessages } from "./process-seen-message.js";
import logger from "../../../../config/logger.js";
import pool from "../../../../config/database-connection.js";

// Use the globally augmented user type
export interface MessageDetail {
  message_id: number;
  sender_id: string;
  conversation_id: number;
}

interface SenderToMessages {
  [senderId: string]: {
    conversation_id: number;
    message_ids: number[];
  };
}

export const markAsSeen = async (req: Request, res: Response) => {
  let connection: PoolConnection | undefined;
  const viewer_id = req.user?.user_id;
  const ip = req.ip;

  if (!viewer_id) {
    logger.warn("Unauthorized attempt to mark messages as seen", { ip });
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { message_id } = req.body as { message_id: number[] };

  if (!Array.isArray(message_id) || message_id.length === 0) {
    logger.warn("Invalid message IDs provided for markAsSeen", { viewer_id, ip, message_id });
    return res.status(400).json({ error: "Invalid message_ids" });
  }

  try {
    connection = await pool.getConnection();

    if (!connection) {
      logger.error("Failed to get DB connection for markAsSeen", { viewer_id, ip });
      return res.status(500).json({ error: "Database connection not available" });
    }

    const { validMessageIds, updated, messageDetails } =
      await processSeenMessages(connection, message_id, viewer_id);

    if (validMessageIds.length === 0) {
      logger.warn("No messages belong to the viewer for markAsSeen", { viewer_id, ip, message_id });
      return res.status(403).json({ error: "No messages belong to the viewer" });
    }

    const senderToMessages: SenderToMessages = {};

    for (const msg of messageDetails) {
      const senderId = msg?.sender_id;
      if (!senderId) continue;

      if (!senderToMessages[senderId]) {
        senderToMessages[senderId] = {
          conversation_id: msg.conversation_id,
          message_ids: [],
        };
      }
      senderToMessages[senderId].message_ids.push(msg.message_id);
    }

    const io = req.app.get("io");
    const userSocketMap: Record<string, string> = req.app.get("userSocketMap");

    for (const [senderId, data] of Object.entries(senderToMessages)) {
      const senderSocketId = userSocketMap[senderId];
      if (senderSocketId) {
        io.to(senderSocketId).emit("messagesSeen", data);
      }
    }

    return res.json({
      success: true,
      updated,
      seenMessageIds: validMessageIds,
    });
  } catch (error: any) {
    logger.error("Unexpected error in markAsSeen handler", {
      ip,
      viewer_id,
      name: error?.name || "UnknownError",
      message: error?.message || "Unknown error",
      stack: error?.stack || "No stack trace",
      cause: error?.cause || "No cause",
      error,
    });
    return res.status(500).json({ error: "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};
