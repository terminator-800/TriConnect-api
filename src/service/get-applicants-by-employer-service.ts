import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { format } from "date-fns";
import logger from "../config/logger.js";

interface GetApplicantsOptions {
  page?: number | string;
  pageSize?: number | string;
}

interface ApplicantRow extends RowDataPacket {
  application_id: number;
  applied_at: Date | string | null;
  job_post_id: number;
  applicant_user_id: number;
  applicant_role: string;
  job_title: string;
  applicant_name: string;
  location: string | null;
}

interface ApplicantsResult {
  total: number;
  page: number;
  pageSize: number;
  applicants: {
    application_id: number;
    applied_at: Date | string | null;
    applied_at_formatted: string;
    job_post_id: number;
    applicant_user_id: number;
    applicant_role: string;
    job_title: string;
    applicant_name: string;
    location: string;
  }[];
}

export async function getApplicantsByEmployer(
  connection: PoolConnection,
  employerUserId: number,
  options: GetApplicantsOptions = {},
): Promise<ApplicantsResult> {

  try {
    const page = Math.max(1, parseInt(options.page?.toString() || "1", 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(options.pageSize?.toString() || "10", 10)));
    const offset = (page - 1) * pageSize;

    const countQuery = `
    SELECT COUNT(*) AS total
    FROM job_applications ja
    JOIN job_post jp ON jp.job_post_id = ja.job_post_id
    WHERE jp.user_id = ?
      AND ja.application_status != 'rejected'
  `;

    const dataQuery = `
    SELECT 
      ja.application_id,
      ja.applied_at,
      ja.job_post_id,
      u.user_id AS applicant_user_id,
      u.role AS applicant_role,
      jp.job_title,
      CASE 
        WHEN u.role = 'jobseeker' THEN js.full_name
        WHEN u.role = 'manpower-provider' THEN mp.agency_name
        ELSE 'Unknown'
      END AS applicant_name,
      CASE 
        WHEN u.role = 'jobseeker' THEN js.present_address
        WHEN u.role = 'manpower-provider' THEN mp.agency_address
        ELSE NULL
      END AS location,
       c.conversation_id -- ✅ NEW: get conversation_id,
    FROM job_applications ja
    JOIN job_post jp ON jp.job_post_id = ja.job_post_id
    JOIN users u ON u.user_id = ja.applicant_id
    LEFT JOIN jobseeker js ON js.jobseeker_id = u.user_id
    LEFT JOIN manpower_provider mp ON mp.manpower_provider_id = u.user_id

      -- ✅ NEW: Join conversations to find existing chat between applicant and employer
      LEFT JOIN conversations c 
        ON ( (c.user1_id = u.user_id AND c.user2_id = jp.user_id) 
          OR (c.user2_id = u.user_id AND c.user1_id = jp.user_id) )

          
    WHERE jp.user_id = ?
      AND ja.application_status != 'rejected'
    ORDER BY ja.applied_at DESC
    LIMIT ? OFFSET ?
  `;

    // Count total
    const [countRows] = await connection.query<RowDataPacket[]>(countQuery, [employerUserId]);
    const totalRow = countRows[0] as { total: number } | undefined;
    const total = totalRow?.total ?? 0;

    // Fetch applicants
    const [rows] = await connection.query<ApplicantRow[]>(dataQuery, [employerUserId, pageSize, offset]);

    return {
      total,
      page,
      pageSize,
      applicants: rows.map((row) => ({
        application_id: row.application_id,
        applied_at: row.applied_at,
        applied_at_formatted: (() => {
          try {
            if (!row.applied_at) return "-";
            const d = new Date(row.applied_at);
            if (Number.isNaN(d.getTime())) return "-";
            return format(d, "MMMM d, yyyy 'at' h:mm a");
          } catch (_) {
            return "-";
          }
        })(),
        job_post_id: row.job_post_id,
        applicant_user_id: row.applicant_user_id,
        applicant_role: row.applicant_role,
        job_title: row.job_title,
        applicant_name: row.applicant_name,
        location: row.location || "-",
        conversation_id: row.conversation_id,
      })),
    };
  } catch (error) {
    throw new Error("Failed to fetch applicants.");
  }
}
