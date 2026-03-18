import pool from '../config/database-connection.js';
import logger from '../config/logger.js';

type NotificationType =
  | 'message'
  | 'job_application'
  | 'job_post_status'
  | 'account_verification'
  | 'report'
  | 'system'
  | 'hire';

class NotificationService {
    private readonly admin_id = 1;

    private async insertNotification(
        user_id: number,
        notifier_id: number | null,
        title: string,
        message: string,
        type: NotificationType,
        ): Promise<void> {
        let connection;
        try {
            connection = await pool.getConnection();
            await connection.execute(
            `INSERT INTO notifications (user_id, notifier_id, title, message, type) VALUES (?, ?, ?, ?, ?)`,
            [user_id, notifier_id, title, message, type]
            );
        } catch (error: any) {
            logger.error('Failed to insert notification', { user_id, notifier_id, error });
        } finally {
            if (connection) connection.release();
        }
    }

    // CORE METHOD — all other methods use this
    async notify(
        user_id: number,
        title: string,
        message: string,
        type: NotificationType,
        notifier_id: number,
    ): Promise<void> {
        await this.insertNotification(user_id, notifier_id, title, message, type);
    }

    // notify admin when user upload requirements
    async notifyAdminOfUpload(notifier_id: number, notifierName: string): Promise<void> {
        await this.notify(
        this.admin_id,
        'NEW REQUIREMENT UPLOADED',
        `${notifierName} uploaded their requirements and is pending for verification. Please review the details and verify the account.`,
        'account_verification',
        notifier_id
        );
    }

    // notify admin when a new job post is created
    async notifyAdminOfJobPost(notifier_id: number, notifierName: string | null = null): Promise<void> {
        await this.notify(
            this.admin_id,
            'NEW JOB POST CREATED',
            `${notifierName}, created a job post that has been submitted and is pending for review.`,
            'job_post_status',
            notifier_id,
        );
    }

    // notify the user when the admin approves the their requirements
    async notifyUserApproval(user_id: number, displayName: string): Promise<void> {
        await this.notify(
        user_id,
        'REQUIREMENTS APPROVED',
        `Hi, ${displayName}, your submitted requirements have been approved. Please check your email for details and access your account.`,
        'account_verification',
        this.admin_id
        );
    }

    // notify the user when the admin rejected the their requirements
    async notifyUserRejection(user_id: number, displayName: string): Promise<void> {
        await this.notify(
        user_id,
        'REQUIREMENTS REJECTED',
        `Hi, ${displayName}, your submitted requirements have been rejected by our Administrator. Please check your email for details and resubmit the correct documents.`,
        'account_verification',
        this.admin_id
        );
    }

    // notify the user when their job post is approved
    async notifyUserOfJobPostApproved(
        user_id: number,
        jobTitle: string,
        notifier_id: number
    ): Promise<void> {
        await this.notify(
            user_id,
            'JOB POST APPROVED',
            `Your job post "${jobTitle}" has been approved and is now live.`,
            'job_post_status',
            notifier_id
        );
    }

    // notify the user when their job post is rejected
    async notifyUserOfJobPostRejected(
        user_id: number,
        jobTitle: string,
        notifier_id: number
        ): Promise<void> {
        await this.notify(
            user_id,
            'JOB POST REJECTED',
            `Your job post "${jobTitle}" has been rejected. Please review and resubmit.`,
            'job_post_status',
            notifier_id
        );
    }

    // this functions is not use
    async notifyUserOfHire(
        user_id: number,
        employerName: string,
        jobTitle: string,
        notifier_id: number
    ): Promise<void> {
        await this.notify(
        user_id,
        'YOU HAVE BEEN HIRED',
        `Congratulations! ${employerName} has hired you for the position of ${jobTitle}.`,
        'hire',
        notifier_id
        );
    }

    // this functions is not use
    async notifyUserOfJobApplication(
        user_id: number,
        applicantName: string,
        jobTitle: string,
        notifier_id: number
    ): Promise<void> {
        await this.notify(
        user_id,
        'NEW JOB APPLICATION',
        `${applicantName} has applied for your job post "${jobTitle}".`,
        'job_application',
        notifier_id
        );
    }
}



export const notificationService = new NotificationService();