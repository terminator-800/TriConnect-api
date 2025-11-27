import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { format, isToday, isThisYear } from 'date-fns';
import logger from '../../../../config/logger.js';

// DB row type returned from your query
interface MessageRow extends RowDataPacket {
    message_id: number;
    conversation_id: number;
    sender_id: number;
    receiver_id: number;
    message_type: 'text' | 'file';
    message_text?: string | null;
    file_url?: string | null;
    created_at: Date;

    sender_role: 'jobseeker' | 'individual-employer' | 'business-employer' | 'manpower-provider';
    sender_name: string;

    receiver_role: 'jobseeker' | 'individual-employer' | 'business-employer' | 'manpower-provider';
    receiver_name: string;
}

export interface FormattedMessage extends Omit<MessageRow, 'created_at'> {
    created_at: string;
}

export const getMessageHistoryByConversationId = async (
    connection: PoolConnection,
    conversation_id: number | string
): Promise<FormattedMessage[]> => {
    try {
        const [messages] = await connection.query<MessageRow[]>(
            `
    SELECT 
      m.*,

      -- Sender info
      sender.role AS sender_role,
      COALESCE(
        be_sender.authorized_person,
        ie_sender.full_name,
        mp_sender.agency_authorized_person,
        js_sender.full_name
      ) AS sender_name,

      -- Receiver info
      receiver.role AS receiver_role,
      COALESCE(
        be_receiver.authorized_person,
        ie_receiver.full_name,
        mp_receiver.agency_authorized_person,
        js_receiver.full_name
      ) AS receiver_name

    FROM messages m

    -- Sender joins
    JOIN users sender ON m.sender_id = sender.user_id
    LEFT JOIN jobseeker js_sender ON sender.user_id = js_sender.jobseeker_id
    LEFT JOIN individual_employer ie_sender ON sender.user_id = ie_sender.individual_employer_id
    LEFT JOIN business_employer be_sender ON sender.user_id = be_sender.business_employer_id
    LEFT JOIN manpower_provider mp_sender ON sender.user_id = mp_sender.manpower_provider_id

    -- Receiver joins
    JOIN users receiver ON m.receiver_id = receiver.user_id
    LEFT JOIN jobseeker js_receiver ON receiver.user_id = js_receiver.jobseeker_id
    LEFT JOIN individual_employer ie_receiver ON receiver.user_id = ie_receiver.individual_employer_id
    LEFT JOIN business_employer be_receiver ON receiver.user_id = be_receiver.business_employer_id
    LEFT JOIN manpower_provider mp_receiver ON receiver.user_id = mp_receiver.manpower_provider_id

    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
    `,
            [conversation_id]
        );

        const formattedMessages: FormattedMessage[] = messages.map(msg => {
            const createdAt = new Date(msg.created_at);
            let displayTime: string;

            if (isToday(createdAt)) {
                displayTime = format(createdAt, 'hh:mm a');
            } else if (isThisYear(createdAt)) {
                displayTime = format(createdAt, 'MMM d');
            } else {
                displayTime = format(createdAt, 'MMM d, yyyy');
            }

            return {
                ...msg,
                created_at: displayTime,
            };
        });

        return formattedMessages;
    } catch (error) {
        throw error;
    }
};
