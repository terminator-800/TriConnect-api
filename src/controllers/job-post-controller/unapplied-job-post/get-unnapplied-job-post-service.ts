import { format } from "date-fns";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import logger from "../../../config/logger.js";

export type UserRole = "jobseeker" | "individual-employer" | "business-employer" | "manpower-provider";

export interface JobPostRow extends RowDataPacket {
  job_post_id: number;
  user_id: number;
  email: string;
  role: UserRole;
  profile?: string;
  job_title: string;
  job_description: string;
  location: string;
  salary_range: string | null;
  required_skill: string | null;
  job_type: string | null;
  created_at: string | Date;
  approved_at: string | Date | null;

  // Business employer fields
  business_name?: string;
  business_address?: string;
  industry?: string;
  business_size?: string;
  be_authorized_person?: string;

  // Individual employer fields
  ie_full_name?: string;
  ie_gender?: string;
  ie_present_address?: string;

  // Manpower provider fields
  agency_name?: string;
  agency_address?: string;
  agency_services?: string;
  agency_authorized_person?: string;
}

export type FlattenedJobPost =
  | ({
    role: "individual-employer";
    employer_name: string;
    submitted_by: string;
    full_name: string;
    gender: string | undefined;
    present_address: string | undefined;
  } & BaseJobPost)
  | ({
    role: "business-employer";
    employer_name: string;
    submitted_by: string;
    business_name: string;
    business_address: string | undefined;
    industry: string | undefined;
    business_size: string | undefined;
    authorized_person: string | undefined;
  } & BaseJobPost)
  | ({
    role: "manpower-provider";
    employer_name: string;
    submitted_by: string;
    agency_name: string;
    agency_address: string | undefined;
    agency_services: string | undefined;
    agency_authorized_person: string | undefined;
  } & BaseJobPost)
  | BaseJobPost;

interface BaseJobPost {
  job_post_id: number;
  user_id: number;
  email: string;
  profile?: string;
  role: UserRole;
  job_title: string;
  job_description: string;
  location: string;
  salary_range: string | null;
  required_skill: string | null;
  job_type: string | null;
  approved_at: string | null;
}

export async function getUnappliedJobPosts(
  connection: PoolConnection,
  applicant_id: number
): Promise<FlattenedJobPost[]> {
  try {
    const [rows] = await connection.query<RowDataPacket[] & JobPostRow[]>(
      `
      SELECT 
        jp.job_post_id,
        jp.user_id,
        jp.job_title,
        jp.job_description,
        jp.location,
        jp.salary_range,
        jp.required_skill,
        jp.job_type,
        jp.created_at,
        jp.approved_at,
        u.role,
        u.email,
        u.profile,

        -- Business employer fields
        be.business_name,
        be.business_address,
        be.industry,
        be.business_size,
        be.authorized_person AS be_authorized_person,

        -- Individual employer fields
        ie.full_name AS ie_full_name,
        ie.gender AS ie_gender,
        ie.present_address AS ie_present_address,

        -- Manpower provider fields
        mp.agency_name,
        mp.agency_address,
        mp.agency_services,
        mp.agency_authorized_person

      FROM job_post jp
      JOIN users u ON jp.user_id = u.user_id

      LEFT JOIN business_employer be 
        ON u.user_id = be.business_employer_id AND u.role = 'business-employer'

      LEFT JOIN individual_employer ie 
        ON u.user_id = ie.individual_employer_id AND u.role = 'individual-employer'

      LEFT JOIN manpower_provider mp 
        ON u.user_id = mp.manpower_provider_id AND u.role = 'manpower-provider'

      WHERE jp.status = 'approved'
        AND jp.is_verified_jobpost = 1
        AND jp.jobpost_status = 'active'
        AND jp.user_id != ?
        AND jp.job_post_id NOT IN (
          SELECT job_post_id FROM job_applications WHERE applicant_id = ?
        )

      ORDER BY jp.created_at DESC;
    `,
      [applicant_id, applicant_id]
    );

    const flattened: FlattenedJobPost[] = rows.map((post) => {
      const base: BaseJobPost = {
        job_post_id: post.job_post_id,
        user_id: post.user_id,
        email: post.email,
        profile: post.profile,
        role: post.role,
        job_title: post.job_title,
        job_description: post.job_description,
        location: post.location,
        salary_range: post.salary_range,
        required_skill: post.required_skill,
        job_type: post.job_type,
        approved_at: post.approved_at
          ? format(new Date(post.approved_at), "MMMM dd, yyyy 'at' hh:mm a")
          : null,
      };

      if (post.role === "individual-employer") {
        return {
          ...base,
          role: "individual-employer",
          employer_name: post.ie_full_name || "",
          submitted_by: post.ie_full_name || "",
          full_name: post.ie_full_name || "",
          gender: post.ie_gender,
          present_address: post.ie_present_address,
        };
      }

      if (post.role === "business-employer") {
        return {
          ...base,
          role: "business-employer",
          employer_name: post.business_name || "",
          submitted_by: post.be_authorized_person || "",
          business_name: post.business_name || "",
          business_address: post.business_address,
          industry: post.industry,
          business_size: post.business_size,
          authorized_person: post.be_authorized_person,
        };
      }

      if (post.role === "manpower-provider") {
        return {
          ...base,
          role: "manpower-provider",
          employer_name: post.agency_name || "",
          submitted_by: post.agency_authorized_person || "",
          agency_name: post.agency_name || "",
          agency_address: post.agency_address,
          agency_services: post.agency_services,
          agency_authorized_person: post.agency_authorized_person,
        };
      }

      return base;
    });

    return flattened;
  } catch (error) {
    throw error;
  }
}
