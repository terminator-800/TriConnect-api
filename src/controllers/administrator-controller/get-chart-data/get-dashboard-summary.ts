import type { Request, Response } from 'express';
import pool from '../../../config/database-connection.js';
import type { RowDataPacket } from 'mysql2';

export interface MonthlyData {
  month: number;
  total: number;
}

export interface DashboardSummary {
  totalJobseekers: number;
  totalEmployers: number;
  totalAgencies: number;
  totalHired: number;
  hireSuccessRate: number;
  jobseekersChangePct: number;
  employersChangePct: number;
  agenciesChangePct: number;
  hireSuccessRateChangePct: number;
}

export interface DashboardResponse {
  period: 'daily' | 'weekly' | 'monthly';
  labels: string[];
  totalJobseekers: number[];
  totalEmployers: number[];
  totalAgencies: number[];
  totalHired: number[];
  summary: DashboardSummary;
}

async function fetchMonthlyData(sql: string, params: any[]): Promise<MonthlyData[]> {
  const [rows] = await pool.query<RowDataPacket[]>(sql, params);
  return (rows as RowDataPacket[]).map((r: any) => ({
    month: Number(r.month),
    total: Number(r.total),
  }));
}

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function weeklyBucketByDay(day: number): number {
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  return 4;
}

export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawPeriod = String(req.query.period || 'daily').toLowerCase();
    const period: 'daily' | 'weekly' | 'monthly' =
      rawPeriod === 'weekly' || rawPeriod === 'monthly' ? rawPeriod : 'daily';

    const today = new Date();
    const year = new Date().getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    if (period === 'monthly') {
      const jobseekers = await fetchMonthlyData(
        `
        SELECT MONTH(created_at) AS month, COUNT(*) AS total
        FROM users
        WHERE role = 'jobseeker' AND YEAR(created_at) = ?
        GROUP BY MONTH(created_at)
        ORDER BY MONTH(created_at);
        `,
        [year]
      );

      const employers = await fetchMonthlyData(
        `
        SELECT MONTH(created_at) AS month, COUNT(*) AS total
        FROM users
        WHERE role IN ('business-employer', 'individual-employer') 
          AND YEAR(created_at) = ?
        GROUP BY MONTH(created_at)
        ORDER BY MONTH(created_at);
        `,
        [year]
      );

      const agencies = await fetchMonthlyData(
        `
        SELECT MONTH(created_at) AS month, COUNT(*) AS total
        FROM users
        WHERE role = 'manpower-provider' AND YEAR(created_at) = ?
        GROUP BY MONTH(created_at)
        ORDER BY MONTH(created_at);
        `,
        [year]
      );

      const hired = await fetchMonthlyData(
        `
        SELECT MONTH(accepted_at) AS month, COUNT(*) AS total
        FROM hires
        WHERE status = 'accepted' 
          AND YEAR(accepted_at) = ?
        GROUP BY MONTH(accepted_at)
        ORDER BY MONTH(accepted_at);
        `,
        [year]
      );

      const toMonthlyArray = (rows: MonthlyData[]): number[] => {
        const arr = Array(12).fill(0);
        rows.forEach(({ month, total }) => {
          arr[month - 1] = total;
        });
        return arr;
      };

      const totalJobseekers = toMonthlyArray(jobseekers);
      const totalEmployers = toMonthlyArray(employers);
      const totalAgencies = toMonthlyArray(agencies);
      const totalHired = toMonthlyArray(hired);

      const currentJobseekers = totalJobseekers.reduce((a, b) => a + b, 0);
      const currentEmployers = totalEmployers.reduce((a, b) => a + b, 0);
      const currentAgencies = totalAgencies.reduce((a, b) => a + b, 0);
      const currentHired = totalHired.reduce((a, b) => a + b, 0);
      const currentHireRate =
        currentEmployers > 0 ? Number(((currentHired / currentEmployers) * 100).toFixed(1)) : 0;

      const prevYear = year - 1;
      const [[prevUsersRow]] = await pool.query<RowDataPacket[]>(
        `
          SELECT
            SUM(CASE WHEN role = 'jobseeker' THEN 1 ELSE 0 END) AS prevJobseekers,
            SUM(CASE WHEN role IN ('business-employer', 'individual-employer') THEN 1 ELSE 0 END) AS prevEmployers,
            SUM(CASE WHEN role = 'manpower-provider' THEN 1 ELSE 0 END) AS prevAgencies
          FROM users
          WHERE YEAR(created_at) = ?;
        `,
        [prevYear]
      );
      const [[prevHireRow]] = await pool.query<RowDataPacket[]>(
        `
          SELECT COUNT(*) AS prevHired
          FROM hires
          WHERE status = 'accepted' AND YEAR(accepted_at) = ?;
        `,
        [prevYear]
      );

      const prevJobseekers = Number(prevUsersRow?.prevJobseekers || 0);
      const prevEmployers = Number(prevUsersRow?.prevEmployers || 0);
      const prevAgencies = Number(prevUsersRow?.prevAgencies || 0);
      const prevHired = Number(prevHireRow?.prevHired || 0);
      const prevHireRate =
        prevEmployers > 0 ? Number(((prevHired / prevEmployers) * 100).toFixed(1)) : 0;

      const summary: DashboardSummary = {
        totalJobseekers: currentJobseekers,
        totalEmployers: currentEmployers,
        totalAgencies: currentAgencies,
        totalHired: currentHired,
        hireSuccessRate: currentHireRate,
        jobseekersChangePct: pctChange(currentJobseekers, prevJobseekers),
        employersChangePct: pctChange(currentEmployers, prevEmployers),
        agenciesChangePct: pctChange(currentAgencies, prevAgencies),
        hireSuccessRateChangePct: pctChange(currentHireRate, prevHireRate),
      };

      const response: DashboardResponse = {
        period,
        labels: [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ],
        totalJobseekers,
        totalEmployers,
        totalAgencies,
        totalHired,
        summary,
      };

      res.status(200).json(response);
      return;
    }

    if (period === 'weekly') {
      const [[currentUsersRow]] = await pool.query<RowDataPacket[]>(
        `
          SELECT
            SUM(CASE WHEN role = 'jobseeker' THEN 1 ELSE 0 END) AS currentJobseekers,
            SUM(CASE WHEN role IN ('business-employer', 'individual-employer') THEN 1 ELSE 0 END) AS currentEmployers,
            SUM(CASE WHEN role = 'manpower-provider' THEN 1 ELSE 0 END) AS currentAgencies
          FROM users
          WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?;
        `,
        [year, month]
      );
      const [[prevUsersRow]] = await pool.query<RowDataPacket[]>(
        `
          SELECT
            SUM(CASE WHEN role = 'jobseeker' THEN 1 ELSE 0 END) AS prevJobseekers,
            SUM(CASE WHEN role IN ('business-employer', 'individual-employer') THEN 1 ELSE 0 END) AS prevEmployers,
            SUM(CASE WHEN role = 'manpower-provider' THEN 1 ELSE 0 END) AS prevAgencies
          FROM users
          WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?;
        `,
        month === 1 ? [year - 1, 12] : [year, month - 1]
      );
      const [[currentHireRow]] = await pool.query<RowDataPacket[]>(
        `
          SELECT COUNT(*) AS currentHired
          FROM hires
          WHERE status = 'accepted' AND YEAR(accepted_at) = ? AND MONTH(accepted_at) = ?;
        `,
        [year, month]
      );
      const [[prevHireRow]] = await pool.query<RowDataPacket[]>(
        `
          SELECT COUNT(*) AS prevHired
          FROM hires
          WHERE status = 'accepted' AND YEAR(accepted_at) = ? AND MONTH(accepted_at) = ?;
        `,
        month === 1 ? [year - 1, 12] : [year, month - 1]
      );

      const [weeklyRows] = await pool.query<RowDataPacket[]>(
        `
          SELECT
            role,
            CASE
              WHEN DAY(created_at) BETWEEN 1 AND 7 THEN 1
              WHEN DAY(created_at) BETWEEN 8 AND 14 THEN 2
              WHEN DAY(created_at) BETWEEN 15 AND 21 THEN 3
              ELSE 4
            END AS wk,
            COUNT(*) AS total
          FROM users
          WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
            AND role IN ('jobseeker', 'business-employer', 'individual-employer', 'manpower-provider')
          GROUP BY role, wk;
        `,
        [year, month]
      );

      const [weeklyHiredRows] = await pool.query<RowDataPacket[]>(
        `
          SELECT
            CASE
              WHEN DAY(accepted_at) BETWEEN 1 AND 7 THEN 1
              WHEN DAY(accepted_at) BETWEEN 8 AND 14 THEN 2
              WHEN DAY(accepted_at) BETWEEN 15 AND 21 THEN 3
              ELSE 4
            END AS wk,
            COUNT(*) AS total
          FROM hires
          WHERE status = 'accepted' AND YEAR(accepted_at) = ? AND MONTH(accepted_at) = ?
          GROUP BY wk;
        `,
        [year, month]
      );

      const totalJobseekers = [0, 0, 0, 0];
      const totalEmployers = [0, 0, 0, 0];
      const totalAgencies = [0, 0, 0, 0];
      const totalHired = [0, 0, 0, 0];

      weeklyRows.forEach((row) => {
        const idx = Number(row.wk) - 1;
        const count = Number(row.total || 0);
        if (idx < 0 || idx > 3) return;
        if (row.role === 'jobseeker') totalJobseekers[idx] = (totalJobseekers[idx] ?? 0) + count;
        if (row.role === 'business-employer' || row.role === 'individual-employer')
          totalEmployers[idx] = (totalEmployers[idx] ?? 0) + count;
        if (row.role === 'manpower-provider')
          totalAgencies[idx] = (totalAgencies[idx] ?? 0) + count;
      });
      weeklyHiredRows.forEach((row) => {
        const idx = Number(row.wk) - 1;
        if (idx >= 0 && idx <= 3) totalHired[idx] = Number(row.total || 0);
      });

      const currentJobseekers = Number(currentUsersRow?.currentJobseekers || 0);
      const currentEmployers = Number(currentUsersRow?.currentEmployers || 0);
      const currentAgencies = Number(currentUsersRow?.currentAgencies || 0);
      const currentHired = Number(currentHireRow?.currentHired || 0);
      const currentHireRate =
        currentEmployers > 0 ? Number(((currentHired / currentEmployers) * 100).toFixed(1)) : 0;

      const prevJobseekers = Number(prevUsersRow?.prevJobseekers || 0);
      const prevEmployers = Number(prevUsersRow?.prevEmployers || 0);
      const prevAgencies = Number(prevUsersRow?.prevAgencies || 0);
      const prevHired = Number(prevHireRow?.prevHired || 0);
      const prevHireRate =
        prevEmployers > 0 ? Number(((prevHired / prevEmployers) * 100).toFixed(1)) : 0;

      const summary: DashboardSummary = {
        totalJobseekers: currentJobseekers,
        totalEmployers: currentEmployers,
        totalAgencies: currentAgencies,
        totalHired: currentHired,
        hireSuccessRate: currentHireRate,
        jobseekersChangePct: pctChange(currentJobseekers, prevJobseekers),
        employersChangePct: pctChange(currentEmployers, prevEmployers),
        agenciesChangePct: pctChange(currentAgencies, prevAgencies),
        hireSuccessRateChangePct: pctChange(currentHireRate, prevHireRate),
      };

      const response: DashboardResponse = {
        period,
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        totalJobseekers,
        totalEmployers,
        totalAgencies,
        totalHired,
        summary,
      };
      res.status(200).json(response);
      return;
    }

    // daily
    const [dailyUserRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT DATE(created_at) AS d, role, COUNT(*) AS total
        FROM users
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
          AND role IN ('jobseeker', 'business-employer', 'individual-employer', 'manpower-provider')
        GROUP BY DATE(created_at), role
        ORDER BY d ASC;
      `
    );
    const [dailyHiredRows] = await pool.query<RowDataPacket[]>(
      `
        SELECT DATE(accepted_at) AS d, COUNT(*) AS total
        FROM hires
        WHERE status = 'accepted'
          AND accepted_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
        GROUP BY DATE(accepted_at)
        ORDER BY d ASC;
      `
    );

    const labels: string[] = [];
    const keys: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      keys.push(key);
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    const jobMap = new Map<string, number>();
    const empMap = new Map<string, number>();
    const agencyMap = new Map<string, number>();
    dailyUserRows.forEach((row) => {
      const key = new Date(row.d).toISOString().slice(0, 10);
      const val = Number(row.total || 0);
      if (row.role === 'jobseeker') jobMap.set(key, (jobMap.get(key) || 0) + val);
      if (row.role === 'business-employer' || row.role === 'individual-employer')
        empMap.set(key, (empMap.get(key) || 0) + val);
      if (row.role === 'manpower-provider') agencyMap.set(key, (agencyMap.get(key) || 0) + val);
    });
    const hireMap = new Map<string, number>();
    dailyHiredRows.forEach((row) => {
      const key = new Date(row.d).toISOString().slice(0, 10);
      hireMap.set(key, Number(row.total || 0));
    });

    const totalJobseekers = keys.map((k) => jobMap.get(k) || 0);
    const totalEmployers = keys.map((k) => empMap.get(k) || 0);
    const totalAgencies = keys.map((k) => agencyMap.get(k) || 0);
    const totalHired = keys.map((k) => hireMap.get(k) || 0);

    const [[currentUsersRow]] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          SUM(CASE WHEN role = 'jobseeker' THEN 1 ELSE 0 END) AS currentJobseekers,
          SUM(CASE WHEN role IN ('business-employer', 'individual-employer') THEN 1 ELSE 0 END) AS currentEmployers,
          SUM(CASE WHEN role = 'manpower-provider' THEN 1 ELSE 0 END) AS currentAgencies
        FROM users
        WHERE role IN ('jobseeker', 'business-employer', 'individual-employer', 'manpower-provider');
      `
    );
    const [[prevUsersRow]] = await pool.query<RowDataPacket[]>(
      `
        SELECT
          SUM(CASE WHEN role = 'jobseeker' THEN 1 ELSE 0 END) AS prevJobseekers,
          SUM(CASE WHEN role IN ('business-employer', 'individual-employer') THEN 1 ELSE 0 END) AS prevEmployers,
          SUM(CASE WHEN role = 'manpower-provider' THEN 1 ELSE 0 END) AS prevAgencies
        FROM users
        WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
      `
    );
    const [[currentHireRow]] = await pool.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS currentHired
        FROM hires
        WHERE status = 'accepted';
      `
    );
    const [[prevHireRow]] = await pool.query<RowDataPacket[]>(
      `
        SELECT COUNT(*) AS prevHired
        FROM hires
        WHERE status = 'accepted' AND DATE(accepted_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY);
      `
    );

    const currentJobseekers = Number(currentUsersRow?.currentJobseekers || 0);
    const currentEmployers = Number(currentUsersRow?.currentEmployers || 0);
    const currentAgencies = Number(currentUsersRow?.currentAgencies || 0);
    const currentHired = Number(currentHireRow?.currentHired || 0);
    const currentHireRate =
      currentEmployers > 0 ? Number(((currentHired / currentEmployers) * 100).toFixed(1)) : 0;

    const prevJobseekers = Number(prevUsersRow?.prevJobseekers || 0);
    const prevEmployers = Number(prevUsersRow?.prevEmployers || 0);
    const prevAgencies = Number(prevUsersRow?.prevAgencies || 0);
    const prevHired = Number(prevHireRow?.prevHired || 0);
    const prevHireRate =
      prevEmployers > 0 ? Number(((prevHired / prevEmployers) * 100).toFixed(1)) : 0;

    const summary: DashboardSummary = {
      totalJobseekers: currentJobseekers,
      totalEmployers: currentEmployers,
      totalAgencies: currentAgencies,
      totalHired: currentHired,
      hireSuccessRate: currentHireRate,
      jobseekersChangePct: pctChange(currentJobseekers, prevJobseekers),
      employersChangePct: pctChange(currentEmployers, prevEmployers),
      agenciesChangePct: pctChange(currentAgencies, prevAgencies),
      hireSuccessRateChangePct: pctChange(currentHireRate, prevHireRate),
    };

    const response: DashboardResponse = {
      period,
      labels,
      totalJobseekers,
      totalEmployers,
      totalAgencies,
      totalHired,
      summary,
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
