import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import logger from "../../../config/logger.js";

export interface ApprovedJobPost extends RowDataPacket {
    job_post_id: number;
    user_id: number;
    job_title: string;
    job_description: string;
    location: string;
    salary_range: string | null;
    status: string;
    job_type: string | null;
    jobpost_status: string | null;
    is_verified_jobpost: number;
    created_at: string | Date;
    full_name?: string | null;
    business_name?: string | null;
    agency_name?: string | null;
    authorized_person?: string | null;
    agency_authorized_person?: string | null;
}

export async function getApprovedJobPosts(
    connection: PoolConnection
): Promise<ApprovedJobPost[]> {
    try {
        const [rows] = await connection.query<RowDataPacket[] & ApprovedJobPost[]>(
            `
      SELECT 
        jp.*,
        u.full_name,
        u.business_name,
        u.agency_name,
        u.authorized_person,
        u.agency_authorized_person
      FROM job_post jp
      JOIN users u ON jp.user_id = u.user_id
      WHERE jp.status = 'approved'
        AND jp.is_verified_jobpost = 1
        AND jp.jobpost_status = 'active'
      `
        );

        return rows;
    } catch (error) {
        throw error;
    }
}
