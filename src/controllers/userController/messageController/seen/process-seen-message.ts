import type { PoolConnection, RowDataPacket, OkPacket } from "mysql2/promise";
import logger from "../../../../config/logger.js";

// Define structure of a message detail
export interface MessageDetail extends RowDataPacket {
    message_id: number;
    sender_id: string;
    receiver_id: string;
    conversation_id: number;
    is_read: boolean;
    read_at: Date | null;
}

export interface ProcessSeenResult {
    validMessageIds: number[];
    updated: number;
    messageDetails: MessageDetail[];
}

export const processSeenMessages = async (
    connection: PoolConnection,
    message_id: number[],
    viewer_id: number
): Promise<ProcessSeenResult> => {

    try {
        if (!Array.isArray(message_id) || message_id.length === 0) {
            return { validMessageIds: [], updated: 0, messageDetails: [] };
        }

        // STEP 1: Filter messages that the viewer is allowed to mark as seen
        const placeholders = message_id.map(() => "?").join(",");

        const [ownedRows] = (await connection.query<RowDataPacket[]>(
            `
    SELECT message_id
    FROM messages
    WHERE message_id IN (${placeholders})
      AND receiver_id = ?
    `,
            [...message_id, viewer_id]
        )) as [RowDataPacket[], any];

        const validMessageIds: number[] = ownedRows.map((row) => row.message_id);

        if (validMessageIds.length === 0) {
            return { validMessageIds: [], updated: 0, messageDetails: [] };
        }

        // STEP 2: Update `is_read` and `read_at`
        const updatePlaceholders = validMessageIds.map(() => "?").join(",");

        const [updateResult] = (await connection.query<OkPacket>(
            `
    UPDATE messages
    SET is_read = TRUE,
        read_at = NOW()
    WHERE message_id IN (${updatePlaceholders}) AND is_read = 0
    `,
            validMessageIds
        )) as [OkPacket, any];

        // STEP 3: Fetch details for response
        const [detailsRows] = (await connection.query<MessageDetail[]>(
            `
    SELECT message_id, sender_id, receiver_id, conversation_id, is_read, read_at
    FROM messages
    WHERE message_id IN (${updatePlaceholders})
    `,
            validMessageIds
        )) as [MessageDetail[], any];

        return {
            validMessageIds,
            updated: updateResult.affectedRows,
            messageDetails: detailsRows,
        };
    } catch (error) {
        return { validMessageIds: [], updated: 0, messageDetails: [] };
    }
};
