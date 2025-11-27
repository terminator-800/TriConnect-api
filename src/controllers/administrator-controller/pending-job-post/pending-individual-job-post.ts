import type { Request, Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import { format } from 'date-fns';
import { ROLE } from '../../../utils/roles.js';
import pool from '../../../config/database-connection.js';
import logger from '../../../config/logger.js';

type Role =
  | 'jobseeker'
  | 'individual-employer'
  | 'business-employer'
  | 'manpower-provider'
  | 'administrator';

interface IndividualJobPostBase {
  individual_job_post_id: number;
  user_id: number;
  worker_name: string | null;
  worker_category: string | null;
  years_of_experience: number | null;
  location: string | null;
  qualifications: string | null;
  skill: string | null;
  applicant_count: number;
  role: Role;
  created_at: string | null;
}

interface ManpowerProviderInfo {
  agency_name: string | null;
  agency_address: string | null;
  agency_services: string | null;
  agency_authorized_person: string | null;
}

type PendingIndividualJobPost = IndividualJobPostBase & ManpowerProviderInfo;

export const pendingIndividualJobPosts = async (req: Request, res: Response) => {
  let connection: PoolConnection | undefined;

  if (req.user?.role !== ROLE.ADMINISTRATOR) {
    logger.warn(
      `Unauthorized attempt by user ID ${req.user?.user_id} to access pending individual job posts.`
    );
    res.status(403).json({ error: 'Forbidden: Admins only.' });
    return;
  }

  try {
    connection = await pool.getConnection();
    const jobposts: PendingIndividualJobPost[] = await getPendingIndividualJobPosts(connection);

    res.status(200).json(jobposts);
  } catch (error: any) {
    logger.error(`Unexpected error in pendingIndividualJobPosts endpoint`, {
      ip: req.ip,
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      name: error?.name || 'UnknownError',
      cause: error?.cause || 'No cause',
      error,
    });
    res.status(500).json({ message: 'Failed to fetch job posts' });
  } finally {
    if (connection) connection.release();
  }
};

async function getPendingIndividualJobPosts(
  connection: PoolConnection
): Promise<PendingIndividualJobPost[]> {
  try {
    const query = `
      SELECT 
        ijp.individual_job_post_id,
        ijp.user_id,
        ijp.worker_name,
        ijp.worker_category,
        ijp.years_of_experience,
        ijp.location,
        ijp.qualifications,
        ijp.skill,
        ijp.applicant_count,
        ijp.created_at,
        u.role,
        
        -- Manpower provider info
        mp.agency_name,
        mp.agency_address,
        mp.agency_services,
        mp.agency_authorized_person

      FROM individual_job_post ijp
      JOIN users u ON ijp.user_id = u.user_id
      LEFT JOIN manpower_provider mp 
        ON u.user_id = mp.manpower_provider_id 
       AND u.role = 'manpower-provider'

      WHERE ijp.status = 'pending'
      ORDER BY ijp.created_at DESC;
    `;

    const [rows]: any[] = await connection.query(query);

    return rows.map((post: any) => {
      const base: IndividualJobPostBase = {
        individual_job_post_id: post.individual_job_post_id,
        user_id: post.user_id,
        worker_name: post.worker_name,
        worker_category: post.worker_category,
        years_of_experience: post.years_of_experience,
        location: post.location,
        qualifications: post.qualifications,
        skill: post.skill,
        applicant_count: post.applicant_count,
        role: post.role,
        created_at: post.created_at
          ? format(new Date(post.created_at), "MMMM d, yyyy 'at' hh:mm a")
          : null,
      };

      return {
        ...base,
        agency_name: post.agency_name,
        agency_address: post.agency_address,
        agency_services: post.agency_services,
        agency_authorized_person: post.agency_authorized_person,
      };
    });
  } catch (error) {
    throw error;
  }
}
