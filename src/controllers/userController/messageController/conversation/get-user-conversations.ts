import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { format } from 'date-fns';
import logger from '../../../../config/logger.js';

// DB row type returned from your query
interface ConversationRow extends RowDataPacket {
    conversation_id: number;
    sender_id: number;
    role: 'jobseeker' | 'individual-employer' | 'business-employer' | 'manpower-provider';
    profile?: string;
    js_full_name?: string;
    ie_full_name?: string;
    business_name?: string;
    agency_name?: string;
    authorized_person?: string;
    authorized_person_id?: string;           // ✅ add this
    agency_authorized_person?: string;
    agency_authorized_person_id?: string;   // ✅ add this
    message_id?: number;
    message_type?: 'text' | 'file';
    message_text?: string | null;
    file_name?: string | null;
    sent_at?: Date | null;
}

// Base conversation type
interface BaseConversation {
    conversation_id: number;
    sender_id: number;
    role: ConversationRow['role'];
    message_text: string;
    sent_at: string | null;
}

// Extended types per role
interface JobseekerConversation extends BaseConversation {
    full_name: string;
}

interface IndividualEmployerConversation extends BaseConversation {
    full_name: string;
}

interface BusinessEmployerConversation extends BaseConversation {
    business_name?: string;
    authorized_person?: string;
    authorized_profile?: string;  // ✅ add this
}

interface ManpowerProviderConversation extends BaseConversation {
    agency_name?: string;
    agency_authorized_person?: string;
    authorized_profile?: string;  // ✅ add this
}

type UserConversation =
    | JobseekerConversation
    | IndividualEmployerConversation
    | BusinessEmployerConversation
    | ManpowerProviderConversation
    | BaseConversation; // fallback

export const getUserConversations = async (
    connection: PoolConnection,
    user_id: number
): Promise<UserConversation[]> => {
    try {
        const [rows] = await connection.query<ConversationRow[]>(
            `
      SELECT 
          c.conversation_id,
          u.user_id AS sender_id,
          u.role,
          u.profile,

          js.full_name AS js_full_name,
          ie.full_name AS ie_full_name,
          be.business_name,
          mp.agency_name,

          be.authorized_person AS authorized_person,
          be.authorized_person_id AS authorized_person_id,   -- ✅ add this

          mp.agency_authorized_person AS agency_authorized_person,
          mp.authorized_person_id AS agency_authorized_person_id, -- ✅ add this

          m.message_id,
          m.message_type,
          LEFT(IFNULL(m.message_text, ''), 30) AS message_text,
          SUBSTRING_INDEX(m.file_url, '/', -1) AS file_name,
          m.created_at AS sent_at

      FROM conversations c
      JOIN users u 
          ON u.user_id = IF(c.user1_id = ?, c.user2_id, c.user1_id)

      LEFT JOIN jobseeker js ON js.jobseeker_id = u.user_id
      LEFT JOIN individual_employer ie ON ie.individual_employer_id = u.user_id
      LEFT JOIN business_employer be ON be.business_employer_id = u.user_id
      LEFT JOIN manpower_provider mp ON mp.manpower_provider_id = u.user_id

      LEFT JOIN messages m 
          ON m.message_id = (
              SELECT msg.message_id
              FROM messages msg
              WHERE msg.conversation_id = c.conversation_id
              ORDER BY msg.created_at DESC, msg.message_id DESC
              LIMIT 1
          )

      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY m.created_at DESC
      `,
            [user_id, user_id, user_id]
        );

        return rows.map((row) => {
            const preview =
                row.message_type === 'file' ? row.file_name || '' : row.message_text || 'No message';

            const base: BaseConversation = {
                conversation_id: row.conversation_id,
                sender_id: row.sender_id,
                role: row.role,
                message_text: preview,
                sent_at: row.sent_at ? format(new Date(row.sent_at), "'at' h:mm a") : null,
            };

            switch (row.role) {

                case 'jobseeker':
                    return {
                        ...base,
                        full_name: row.js_full_name!,
                        profile: row.profile,
                    } as JobseekerConversation;

                case 'individual-employer':
                    return {
                        ...base,
                        full_name: row.ie_full_name!,
                        profile: row.profile,
                    } as IndividualEmployerConversation;

                case 'business-employer':
                    return {
                        ...base,
                        business_name: row.business_name,
                        authorized_person: row.authorized_person,
                        profile: row.profile,
                        authorized_profile: row.authorized_person_id,
                    } as BusinessEmployerConversation;

                case 'manpower-provider':
                    return {
                        ...base,
                        agency_name: row.agency_name,
                        agency_authorized_person: row.agency_authorized_person,
                        profile: row.profile,
                        authorized_profile: row.agency_authorized_person_id,
                    } as ManpowerProviderConversation;

                default:
                    return base;
            }
        });
    } catch (error) {
        logger.error("Failed to fetch user conversations", { error, user_id });
        return [];
    }
};

export type { UserConversation };
