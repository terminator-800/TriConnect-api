import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

interface DeleteHireMessageResult {
  success: boolean;
  message: string;
  deletedCount?: number;
  deletedMessages?: Array<{
    message_id: number;
    job_title: string;
    created_at: string;
  }>;
}

interface DeleteHireOfferResult {
  success: boolean;
  message: string;
  deletedCount?: number;
  deletedOffers?: Array<{
    hire_id: number;
    job_title: string;
    status: string;
    created_at: string;
  }>;
}

interface DeleteHireDataResult {
  messageResult: DeleteHireMessageResult;
  // offerResult: DeleteHireOfferResult;
  overallSuccess: boolean;
}

/**
 * Deletes hire messages between an employer and applicant
 * @param connection - Database connection
 * @param employer_id - ID of the employer (sender)
 * @param applicant_id - ID of the applicant (receiver)
 * @returns Object indicating deletion success and details
 */
export const deleteHireMessage = async (
  connection: PoolConnection,
  employer_id: number,
  applicant_id: number
): Promise<DeleteHireMessageResult> => {
  try {
    // First, fetch the messages that will be deleted for logging/confirmation
    const [messagesToDelete] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        message_id,
        job_title,
        created_at
      FROM messages
      WHERE sender_id = ?
        AND receiver_id = ?
        AND message_type = 'hire'
        AND start_date IS NOT NULL
        AND end_date IS NOT NULL
      ORDER BY created_at DESC`,
      [employer_id, applicant_id]
    );

    if (messagesToDelete.length === 0) {
      return {
        success: false,
        message: 'No hire messages found to delete'
      };
    }

    // Delete the messages
    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM messages
      WHERE sender_id = ?
        AND receiver_id = ?
        AND message_type = 'hire'
        AND start_date IS NOT NULL
        AND end_date IS NOT NULL`,
      [employer_id, applicant_id]
    );

    return {
      success: true,
      message: `Successfully deleted ${result.affectedRows} hire message(s)`,
      deletedCount: result.affectedRows,
      deletedMessages: messagesToDelete.map(msg => ({
        message_id: msg.message_id,
        job_title: msg.job_title || 'Unknown Position',
        created_at: msg.created_at
      }))
    };

  } catch (error) {
    console.error('Error deleting hire messages:', error);
    throw new Error('Failed to delete hire messages');
  }
};

/**
 * Deletes hire offers between an employer and applicant
 * @param connection - Database connection
 * @param employer_id - ID of the employer
 * @param applicant_id - ID of the applicant/employee
 * @returns Object indicating deletion success and details
 */
export const deleteHireOffer = async (
  connection: PoolConnection,
  employer_id: number,
  applicant_id: number
): Promise<DeleteHireOfferResult> => {
  try {
    // First, fetch the hire offers that will be deleted for logging/confirmation
    const [offersToDelete] = await connection.execute<RowDataPacket[]>(
      `SELECT 
        hire_id,
        job_title,
        status,
        created_at
      FROM hires
      WHERE employer_id = ?
        AND employee_id = ?
      ORDER BY created_at DESC`,
      [employer_id, applicant_id]
    );

    if (offersToDelete.length === 0) {
      return {
        success: false,
        message: 'No hire offers found to delete'
      };
    }

    // Delete the hire offers
    const [result] = await connection.execute<ResultSetHeader>(
      `DELETE FROM hires
      WHERE employer_id = ?
        AND employee_id = ?`,
      [employer_id, applicant_id]
    );

    return {
      success: true,
      message: `Successfully deleted ${result.affectedRows} hire offer(s)`,
      deletedCount: result.affectedRows,
      deletedOffers: offersToDelete.map(offer => ({
        hire_id: offer.hire_id,
        job_title: offer.job_title || 'Unknown Position',
        status: offer.status,
        created_at: offer.created_at
      }))
    };

  } catch (error) {
    console.error('Error deleting hire offers:', error);
    throw new Error('Failed to delete hire offers');
  }
};

/**
 * Deletes both hire messages and hire offers between an employer and applicant
 * @param connection - Database connection
 * @param employer_id - ID of the employer
 * @param applicant_id - ID of the applicant/employee
 * @returns Combined result of both deletions
 */
export const deleteHireData = async (
  connection: PoolConnection,
  employer_id: number,
  applicant_id: number
): Promise<DeleteHireDataResult> => {
  try {
    const messageResult = await deleteHireMessage(connection, employer_id, applicant_id);
    // const offerResult = await deleteHireOffer(connection, employer_id, applicant_id);

    return {
      messageResult,
      // offerResult,
      overallSuccess: messageResult.success  // || offerResult.success
    };

  } catch (error) {
    console.error('Error deleting hire data:', error);
    throw new Error('Failed to delete hire data');
  }
};