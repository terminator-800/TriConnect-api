import type { Request, Response } from "express";
import pool from "../../../config/database-connection.js";
import type { RowDataPacket } from "mysql2";

export interface MonthlyData {
    month: number;
    total: number;
}

export interface DashboardSummary {
    totalJobseekersYear: number;
    totalEmployersYear: number;
    totalAgenciesYear: number;
    totalHiredYear: number;
}

export interface DashboardResponse {
    labels: string[];
    totalJobseekers: number[];
    totalEmployers: number[];
    totalAgencies: number[];
    totalHired: number[];
    summary: DashboardSummary;
}

// ✅ Reusable helper to fetch and map MySQL rows into MonthlyData[]
async function fetchMonthlyData(sql: string, params: any[]): Promise<MonthlyData[]> {
    const [rows] = await pool.query<RowDataPacket[]>(sql, params);
    // Explicitly map to your own type so TS knows the structure
    return (rows as RowDataPacket[]).map((r: any) => ({
        month: Number(r.month),
        total: Number(r.total),
    }));
}

export const getDashboardSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const year = new Date().getFullYear();

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
      SELECT MONTH(applied_at) AS month, COUNT(*) AS total
      FROM job_applications
      WHERE application_status = 'accepted' 
        AND YEAR(applied_at) = ?
      GROUP BY MONTH(applied_at)
      ORDER BY MONTH(applied_at);
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

        const summary: DashboardSummary = {
            totalJobseekersYear: totalJobseekers.reduce((a, b) => a + b, 0),
            totalEmployersYear: totalEmployers.reduce((a, b) => a + b, 0),
            totalAgenciesYear: totalAgencies.reduce((a, b) => a + b, 0),
            totalHiredYear: totalHired.reduce((a, b) => a + b, 0),
        };

        const response: DashboardResponse = {
            labels: [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December",
            ],
            totalJobseekers,
            totalEmployers,
            totalAgencies,
            totalHired,
            summary,
        };

        res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching dashboard summary:", error);
        res.status(500).json({ message: "Server error" });
    }
};
