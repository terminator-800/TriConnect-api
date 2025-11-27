import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { Server, Socket } from "socket.io";
import pool from "./database-connection.js";

type UserSocketMap = Record<number, string>;

interface MessageRow extends RowDataPacket {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: number;
  created_at: Date;
  sender_name?: string;
}

interface ConversationUpdate {
  conversation_id: number;
  last_message: MessageRow;
}

interface WithDbCallback<T> {
  (connection: PoolConnection): Promise<T>;
}

type EmitGlobalMessage = (message: MessageRow) => void;

function initializeSocket(server: any, userSocketMap: UserSocketMap) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  const withDb = async <T>(callback: WithDbCallback<T>): Promise<T> => {
    const connection = await pool.getConnection();
    try {
      return await callback(connection);
    } finally {
      connection.release();
    }
  };

  io.on("connection", (socket: Socket) => {

    socket.on("joinRoom", (roomId: string | number) => {
      if (!roomId) return socket.join(roomId.toString());
    });

    socket.on("leaveRoom", (roomId: string | number) => {
      if (!roomId) return socket.leave(roomId.toString());
    });

    socket.on("register", (user_id: number) => {
      if (userSocketMap[user_id] && userSocketMap[user_id] !== socket.id) {

      }
      userSocketMap[user_id] = socket.id;
      sendQueuedMessages(user_id, socket);
    });
    
    socket.on(
      "markMessagesSeen",
      async (
        data: { conversation_id: number; user_id: number },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        try {
          await withDb(async (conn) => {
            await conn.query(
              `UPDATE messages SET is_read = 1, read_at = NOW() WHERE conversation_id = ? AND receiver_id = ? AND is_read = 0`,
              [data.conversation_id, data.user_id]
            );
          });

          socket.to(data.conversation_id.toString()).emit("messagesSeen", data);
          io.emit("messagesSeen", data);

          if (callback) callback({ success: true });
        } catch (err: any) {
          if (callback) callback({ success: false, error: "Unable to mark messages as seen" });
        }
      }
    );

    socket.on("disconnect", () => {
      const disconnectedUserId = Object.keys(userSocketMap).find(
        (key) => userSocketMap[Number(key)] === socket.id
      );

      if (disconnectedUserId) {
        delete userSocketMap[Number(disconnectedUserId)];
      } else {

      }
    });
  });

  const sendQueuedMessages = async (userId: number, socket: Socket) => {
    try {
      await withDb(async (conn) => {
        const [messages] = await conn.query<MessageRow[] & RowDataPacket[]>(
          `SELECT m.*, c.conversation_id
           FROM messages m
           JOIN conversations c ON m.conversation_id = c.conversation_id
           WHERE m.receiver_id = ? AND m.is_read = 0
           ORDER BY m.created_at DESC
           LIMIT 10`,
          [userId]
        );

        for (const message of messages) {
          try {
            const [userResult] = await conn.query<RowDataPacket[]>(
              "SELECT role FROM users WHERE user_id = ?",
              [message.sender_id]
            );

            if (userResult.length > 0) {
              const senderRole = userResult[0]!.role as string;
              let tableName: string;

              switch (senderRole) {
                case "jobseeker":
                  tableName = "jobseeker";
                  break;
                case "business-employer":
                  tableName = "business_employer";
                  break;
                case "individual-employer":
                  tableName = "individual_employer";
                  break;
                case "manpower-provider":
                  tableName = "manpower_provider";
                  break;
                case "administrator":
                  tableName = "administrators";
                  break;
                default:
                  tableName = "users";
              }

              const [nameResult] = await conn.query<RowDataPacket[]>(
                `SELECT full_name FROM ${tableName} WHERE ${tableName === "jobseeker"
                  ? "jobseeker_id"
                  : tableName === "business_employer"
                    ? "business_employer_id"
                    : tableName === "individual_employer"
                      ? "individual_employer_id"
                      : tableName === "manpower_provider"
                        ? "manpower_provider_id"
                        : "user_id"
                } = ?`,
                [message.sender_id]
              );

              message.sender_name =
                nameResult.length > 0 ? nameResult[0]!.full_name : "Unknown User";
            } else {
              message.sender_name = "Unknown User";
            }
          } catch (error: any) {
            message.sender_name = "Unknown User";
          }

          socket.emit("receiveMessage", message);
        }
      });
    } catch (err) {
      throw err;
    }
  };

  const emitGlobalMessage: EmitGlobalMessage = (message) => {
    io.to(message.conversation_id.toString()).emit("receiveMessage", message);
    io.emit("receiveMessage", message);

    const conversationUpdate: ConversationUpdate = {
      conversation_id: message.conversation_id,
      last_message: message,
    };
    io.emit("conversationUpdate", conversationUpdate);
  };

  // Attach emitGlobalMessage to io object
  (io as any).emitGlobalMessage = emitGlobalMessage;

  return io;
}

export default initializeSocket;
