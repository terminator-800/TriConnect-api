import { formatDistanceToNow } from "date-fns";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Response } from "express";
import type { CustomRequest } from "../../../types/express/auth.js";
import { ROLE } from "../../../utils/roles.js";
import pool from "../../../config/database-connection.js";
import logger from "../../../config/logger.js";

// ------------------ Types ------------------

export interface IndividualJobPostRow extends RowDataPacket {
  individual_job_post_id: number;
  user_id: number;
  worker_name: string | null;
  worker_category: string | null;
  years_of_experience: number | null;
  location: string | null;
  qualifications: string | null;
  skill: string | null;
  applicant_count: number;
  approved_at: string | Date | null;

  agency_name?: string;
  agency_address?: string;
  agency_services?: string;
  agency_authorized_person?: string;
}

export interface TeamJobPostRow extends RowDataPacket {
  team_job_post_id: number;
  user_id: number;
  worker_category: string | null;
  number_of_workers: number | null;
  location: string | null;
  senior_workers: number | null;
  mid_level_workers: number | null;
  junior_workers: number | null;
  entry_level_workers: number | null;
  team_skills: string | null;
  applicant_count: number;
  approved_at: string | Date | null;

  agency_name?: string;
  agency_address?: string;
  agency_services?: string;
  agency_authorized_person?: string;
}

export type FlattenedMPJobPost =
  | ({ type: "individual" } & IndividualJobPostRow)
  | ({ type: "team" } & TeamJobPostRow);

// ------------------ Service ------------------

export async function getUnappliedMPJobPosts(
  connection: PoolConnection,
  employer_id: number
): Promise<FlattenedMPJobPost[]> {
  try {
    // Individual job posts
    const [individualRows] = await connection.query<IndividualJobPostRow[]>(`
      SELECT i.*, mp.agency_name, mp.agency_address, mp.agency_services, mp.agency_authorized_person
      FROM individual_job_post i
      JOIN users u ON i.user_id = u.user_id
      JOIN manpower_provider mp ON u.user_id = mp.manpower_provider_id
      WHERE i.is_verified_jobpost = 1
        AND i.jobpost_status = 'active'
        AND i.user_id != ?
        AND i.individual_job_post_id NOT IN (
          SELECT job_post_id FROM job_applications WHERE applicant_id = ?
        )
      ORDER BY i.created_at DESC
    `, [employer_id, employer_id]);

    // Team job posts
    const [teamRows] = await connection.query<TeamJobPostRow[]>(`
      SELECT t.*, mp.agency_name, mp.agency_address, mp.agency_services, mp.agency_authorized_person
      FROM team_job_post t
      JOIN users u ON t.user_id = u.user_id
      JOIN manpower_provider mp ON u.user_id = mp.manpower_provider_id
      WHERE t.is_verified_jobpost = 1
        AND t.jobpost_status = 'active'
        AND t.user_id != ?
        AND t.team_job_post_id NOT IN (
          SELECT job_post_id FROM job_applications WHERE applicant_id = ?
        )
      ORDER BY t.created_at DESC
    `, [employer_id, employer_id]);

    // Flatten and format relative time for created_at
    return [
      ...individualRows.map((r) => ({
        ...r,
        type: "individual",
        created_at: r.created_at
          ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true })
          : null,
        approved_at: r.approved_at
          ? formatDistanceToNow(new Date(r.approved_at), { addSuffix: true })
          : null,
      })) as FlattenedMPJobPost[],
      ...teamRows.map((r) => ({
        ...r,
        type: "team",
        created_at: r.created_at
          ? formatDistanceToNow(new Date(r.created_at), { addSuffix: true })
          : null,
        approved_at: r.approved_at
          ? formatDistanceToNow(new Date(r.approved_at), { addSuffix: true })
          : null,
      })) as FlattenedMPJobPost[],
    ];

  } catch (error) {
    throw error;
  }
}

// ------------------ Controller ------------------

export const getAgencyPostsController = async (
  req: CustomRequest,
  res: Response
): Promise<void> => {
  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();
    const employer_id = req.user?.user_id;
    const role = req.user?.role;

    if (!employer_id || (role !== ROLE.BUSINESS_EMPLOYER && role !== ROLE.INDIVIDUAL_EMPLOYER)) {
      res.status(403).json({ error: "Forbidden: Only business or individual employers can access this endpoint" });
      return;
    }

    const jobPosts = await getUnappliedMPJobPosts(connection, employer_id);
    res.status(200).json(jobPosts);
  } catch (error: any) {
    logger.error("Failed to fetch unapplied manpower provider job posts", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack,
      ip: req.ip,
    });
    res.status(500).json({ error: "Failed to fetch job posts" });
  } finally {
    if (connection) connection.release();
  }
};
