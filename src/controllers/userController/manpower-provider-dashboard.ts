import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../types/express/auth.js';
import { format } from 'date-fns';
import logger from '../../config/logger.js';
import pool from '../../config/database-connection.js';

// Types for query results
interface MemberStatsRow extends RowDataPacket {
  total_members: number;
  available_count: number;
  deployed_count: number;
}

interface CompletedHiresRow extends RowDataPacket {
  completed_count: number;
}

interface IndividualJobPostRow extends RowDataPacket {
  job_post_id: number;
  worker_category: string;
  post_type: 'Individual';
  created_at: Date | string | null;
  jobpost_status: string | null;
  applicant_count: number;
}

interface TeamJobPostRow extends RowDataPacket {
  job_post_id: number;
  worker_category: string;
  post_type: 'Team';
  created_at: Date | string | null;
  jobpost_status: string | null;
  applicant_count: number;
}

interface HiringJobPostRow extends RowDataPacket {
  job_post_id: number;
  job_title: string;
  post_type: 'Hiring';
  created_at: Date | string | null;
  jobpost_status: string | null;
  applicant_count: number;
}

interface RecentRequestRow extends RowDataPacket {
  application_id: number;
  employer_id: number;
  employer_name: string;
  job_category: string;
  number_of_workers: number;
  location: string;
  request_date: Date | string | null;
}

// Request type with authenticated user
type ManpowerDashboardRequest = Request & {
  user?: AuthenticatedUser;
};

export const manpowerProviderDashboard = async (
  req: ManpowerDashboardRequest,
  res: Response
): Promise<Response> => {
  let connection: PoolConnection | undefined;
  const ip = req.ip;
  const user_id = req.user?.user_id;

  try {
    const providerId = req.user?.user_id;

    if (!providerId) {
      logger.warn('Unauthorized access attempt to manpower provider dashboard', { ip });
      return res.status(401).json({ message: 'Unauthorized' });
    }

    connection = await pool.getConnection();

    if (!connection) {
      logger.error('Failed to obtain DB connection', { ip, user_id });
      return res.status(500).json({ message: 'Internal server error' });
    }

    // ==========================================
    // 1. MEMBER STATS (Total, Available, Deployed)
    // ==========================================
    const [memberStatsRows] = await connection.query<MemberStatsRow[]>(
      `
      SELECT 
        COUNT(*) AS total_members,
        SUM(CASE WHEN employment_status = 'available' THEN 1 ELSE 0 END) AS available_count,
        SUM(CASE WHEN employment_status = 'hired' THEN 1 ELSE 0 END) AS deployed_count
      FROM users
      WHERE employer_id = ?
        AND role = 'jobseeker'
        AND account_status = 'active'
      `,
      [providerId]
    );

    // ==========================================
    // 2. COMPLETED HIRES COUNT
    // ==========================================
    const [completedHiresRows] = await connection.query<CompletedHiresRow[]>(
      `
      SELECT COUNT(*) AS completed_count
      FROM hires h
      JOIN users u ON h.employee_id = u.user_id
      WHERE u.employer_id = ?
        AND h.status = 'completed'
      `,
      [providerId]
    );

    const stats = {
      totalMembers: Number(memberStatsRows[0]?.total_members || 0),
      available: Number(memberStatsRows[0]?.available_count || 0),
      deployed: Number(memberStatsRows[0]?.deployed_count || 0),
      completed: Number(completedHiresRows[0]?.completed_count || 0),
    };

    // ==========================================
    // 3. RECENT POSTS (Individual, Team, and Hiring posts)
    // ==========================================
    // Get query parameter for filtering post type
    const postTypeFilter = req.query.postType as string | undefined;

    // Individual Job Posts
    const [individualPostsRows] = await connection.query<IndividualJobPostRow[]>(
      `
      SELECT 
        ijp.individual_job_post_id AS job_post_id,
        ijp.worker_category,
        'Individual' AS post_type,
        ijp.created_at,
        ijp.jobpost_status,
        ijp.applicant_count
      FROM individual_job_post ijp
      WHERE ijp.user_id = ?
        AND (ijp.jobpost_status != 'deleted' OR ijp.jobpost_status IS NULL)
      ORDER BY ijp.created_at DESC
      LIMIT 10
      `,
      [providerId]
    );

    // Team Job Posts
    const [teamPostsRows] = await connection.query<TeamJobPostRow[]>(
      `
      SELECT 
        tjp.team_job_post_id AS job_post_id,
        tjp.worker_category,
        'Team' AS post_type,
        tjp.created_at,
        tjp.jobpost_status,
        tjp.applicant_count
      FROM team_job_post tjp
      WHERE tjp.user_id = ?
        AND (tjp.jobpost_status != 'deleted' OR tjp.jobpost_status IS NULL)
      ORDER BY tjp.created_at DESC
      LIMIT 10
      `,
      [providerId]
    );

    // Hiring Job Posts (regular job_post table)
    const [hiringPostsRows] = await connection.query<HiringJobPostRow[]>(
      `
      SELECT 
        jp.job_post_id,
        jp.job_title,
        'Hiring' AS post_type,
        jp.created_at,
        jp.jobpost_status,
        jp.applicant_count
      FROM job_post jp
      WHERE jp.user_id = ?
        AND (jp.jobpost_status != 'deleted' OR jp.jobpost_status IS NULL)
      ORDER BY jp.created_at DESC
      LIMIT 10
      `,
      [providerId]
    );

    // Combine and format all posts
    let allPosts = [
      ...individualPostsRows.map((row) => ({
        job_post_id: row.job_post_id,
        job_title: row.worker_category || 'Untitled',
        post_type: 'Individual' as const,
        date_posted: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd') : '-',
        applicant_count: Number(row.applicant_count || 0),
        status: row.jobpost_status || 'pending',
      })),
      ...teamPostsRows.map((row) => ({
        job_post_id: row.job_post_id,
        job_title: row.worker_category || 'Untitled',
        post_type: 'Team' as const,
        date_posted: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd') : '-',
        applicant_count: Number(row.applicant_count || 0),
        status: row.jobpost_status || 'pending',
      })),
      ...hiringPostsRows.map((row) => ({
        job_post_id: row.job_post_id,
        job_title: row.job_title || 'Untitled',
        post_type: 'Hiring' as const,
        date_posted: row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd') : '-',
        applicant_count: Number(row.applicant_count || 0),
        status: row.jobpost_status || 'pending',
      })),
    ];

    // Filter by post type if specified
    if (postTypeFilter && ['Individual', 'Team', 'Hiring'].includes(postTypeFilter)) {
      allPosts = allPosts.filter((post) => post.post_type === postTypeFilter);
    }

    // Sort by date and limit to recent 10
    const recentPosts = allPosts
      .sort((a, b) => {
        const dateA = a.date_posted === '-' ? 0 : new Date(a.date_posted).getTime();
        const dateB = b.date_posted === '-' ? 0 : new Date(b.date_posted).getTime();
        return dateB - dateA;
      })
      .slice(0, 10);

    // ==========================================
    // 4. RECENT REQUESTS (Hire requests from employers for manpower provider's members)
    // ==========================================
    const [recentRequestsRows] = await connection.query<RecentRequestRow[]>(
      `
      SELECT 
        h.hire_id AS application_id,
        h.employer_id,
        COALESCE(be.business_name, ie.full_name, js.full_name, mp.agency_name, 'Unknown') AS employer_name,
        h.job_title AS job_category,
        COUNT(*) OVER (PARTITION BY h.employer_id, h.job_title, DATE(h.created_at)) AS number_of_workers,
        COALESCE(be.business_address, ie.present_address, js.present_address, mp.agency_address, 'Unknown') AS location,
        h.created_at AS request_date
      FROM hires h
      JOIN users emp ON h.employee_id = emp.user_id
      LEFT JOIN business_employer be ON h.employer_id = be.business_employer_id
      LEFT JOIN individual_employer ie ON h.employer_id = ie.individual_employer_id
      LEFT JOIN jobseeker js ON h.employer_id = js.jobseeker_id
      LEFT JOIN manpower_provider mp ON h.employer_id = mp.manpower_provider_id
      WHERE emp.employer_id = ?
        AND h.status = 'pending'
      ORDER BY h.created_at DESC
      LIMIT 10
      `,
      [providerId]
    );

    const recentRequests = recentRequestsRows.map((row) => ({
      application_id: row.application_id,
      employer_id: row.employer_id,
      employer_name: row.employer_name,
      job_category: row.job_category || 'Unknown',
      number_of_workers: Number(row.number_of_workers || 1),
      location: row.location || 'Unknown',
      request_date: row.request_date ? format(new Date(row.request_date), 'yyyy-MM-dd') : '-',
    }));

    logger.info('Manpower provider dashboard loaded successfully', { user_id: providerId });

    return res.status(200).json({
      stats,
      recentPosts,
      recentRequests,
    });
  } catch (error: any) {
    logger.error('Failed to load manpower provider dashboard', {
      ip,
      user_id,
      name: error?.name || 'UnknownError',
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      cause: error?.cause || 'No cause',
      error,
    });
    return res.status(500).json({ message: 'Failed to load dashboard' });
  } finally {
    if (connection) connection.release();
  }
};
