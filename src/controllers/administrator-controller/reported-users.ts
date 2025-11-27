import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import type { Request, Response } from "express";
import { format } from "date-fns";
import pool from "../../config/database-connection.js";
import logger from "../../config/logger.js";

// --- DB Row Types ---
interface ReportRow extends RowDataPacket {
    report_id: number;
    reason: string;
    message: string;
    created_at: Date | string;
    reporter_id: number;
    reported_user_id: number;
    report_status: string;
    reported_user_profile?: string;
    reported_user_role: string;
    reported_user_status: string;
    reporter_role: string;

    reporter_js_name?: string;
    reporter_ie_name?: string;
    reporter_mp_agency_name?: string;
    reporter_mp_authorized_person?: string;
    reporter_be_business_name?: string;
    reporter_be_authorized_person?: string;

    reported_js_name?: string;
    reported_ie_name?: string;
    reported_mp_agency_name?: string;
    reported_mp_authorized_person?: string;
    reported_be_business_name?: string;
    reported_be_authorized_person?: string;
}

interface ProofRow extends RowDataPacket {
    proof_id: number;
    file_url: string;
    file_type: string;
    uploaded_at: Date | string;
}

// --- Formatted Response Types ---
interface FormattedProof {
    proof_id: number;
    file_url: string;
    file_type: string;
    uploaded_at: string;
}

interface FormattedUser {
    user_id: number;
    role: string;
    status?: string;
    name: string;
    entity: string;
    profile?: string | null;
}

interface FormattedReport {
    report_id: number;
    reason: string;
    message: string;
    created_at: string;
    can_view: boolean;
    reporter: FormattedUser;
    reported_user: FormattedUser;
    proofs: FormattedProof[];
}

export const reportedUsers = async (req: Request, res: Response): Promise<void> => {
    let connection: PoolConnection | undefined;

    if (req.user?.role !== "administrator") {
        logger.warn(`Unauthorized access attempt by user ID ${req.user?.user_id}.`);
        res.status(403).json({ error: "Forbidden: Admins only." });
        return;
    }

    try {
        connection = await pool.getConnection();

        const [rows] = await connection.query<ReportRow[]>(`
            SELECT 
                r.report_id,
                r.reason,
                r.message,
                r.created_at,
                r.reported_by AS reporter_id,
                r.reported_user_id,
                r.status AS report_status,

                ru.role AS reported_user_role,
                ru.account_status AS reported_user_status,
                ru.profile AS reported_user_profile,
                rr.role AS reporter_role,

                -- Reporter Names and Extra Info
                js1.full_name AS reporter_js_name,
                ie1.full_name AS reporter_ie_name,
                mp1.agency_name AS reporter_mp_agency_name,
                mp1.agency_authorized_person AS reporter_mp_authorized_person,
                be1.business_name AS reporter_be_business_name,
                be1.authorized_person AS reporter_be_authorized_person,

                -- Reported User Names and Extra Info
                js2.full_name AS reported_js_name,
                ie2.full_name AS reported_ie_name,
                mp2.agency_name AS reported_mp_agency_name,
                mp2.agency_authorized_person AS reported_mp_authorized_person,
                be2.business_name AS reported_be_business_name,
                be2.authorized_person AS reported_be_authorized_person

            FROM reports r

            -- Reporter
            LEFT JOIN users rr ON r.reported_by = rr.user_id
            LEFT JOIN jobseeker js1 ON rr.user_id = js1.jobseeker_id
            LEFT JOIN individual_employer ie1 ON rr.user_id = ie1.individual_employer_id
            LEFT JOIN manpower_provider mp1 ON rr.user_id = mp1.manpower_provider_id
            LEFT JOIN business_employer be1 ON rr.user_id = be1.business_employer_id

            -- Reported User
            LEFT JOIN users ru ON r.reported_user_id = ru.user_id
            LEFT JOIN jobseeker js2 ON ru.user_id = js2.jobseeker_id
            LEFT JOIN individual_employer ie2 ON ru.user_id = ie2.individual_employer_id
            LEFT JOIN manpower_provider mp2 ON ru.user_id = mp2.manpower_provider_id
            LEFT JOIN business_employer be2 ON ru.user_id = be2.business_employer_id

            WHERE ru.account_status != 'restricted'
            ORDER BY r.created_at DESC
        `);

        const formattedReports: FormattedReport[] = await Promise.all(
            rows.map(async (row) => {

                const [proofs] = await connection!.query<ProofRow[]>(
                    `SELECT proof_id, file_url, file_type, uploaded_at FROM report_proofs WHERE report_id = ?`,
                    [row.report_id]
                );

                const reporter_name = row.reporter_js_name || row.reporter_ie_name || row.reporter_mp_authorized_person || row.reporter_be_authorized_person || "Unknown";
                const reporter_entity = row.reporter_js_name || row.reporter_ie_name || row.reporter_mp_agency_name || row.reporter_be_business_name || "Unknown";

                const reported_name = row.reported_js_name || row.reported_ie_name || row.reported_mp_authorized_person || row.reported_be_authorized_person || "Unknown";
                const reported_entity = row.reported_js_name || row.reported_ie_name || row.reported_mp_agency_name || row.reported_be_business_name || "Unknown";

                return {
                    report_id: row.report_id,
                    reason: row.reason,
                    message: row.message,
                    created_at: format(new Date(row.created_at), "MMMM d, yyyy 'at' hh:mm a"),
                    can_view: true,
                    reporter: {
                        user_id: row.reporter_id,
                        role: row.reporter_role,
                        name: reporter_name,
                        entity: reporter_entity,
                    },
                    reported_user: {
                        user_id: row.reported_user_id,
                        role: row.reported_user_role,
                        status: row.reported_user_status,
                        name: reported_name,
                        entity: reported_entity,
                        profile: row.reported_user_profile || null
                    },
                    proofs: proofs.map((proof) => ({
                        proof_id: proof.proof_id,
                        file_url: proof.file_url,
                        file_type: proof.file_type,
                        uploaded_at: format(new Date(proof.uploaded_at), "MMMM d, yyyy 'at' hh:mm a"),
                    })),
                };
            })
        );

        res.json(formattedReports);
    } catch (error: any) {
        logger.error("Error in reportedUsers endpoint", {
            ip: req.ip,
            message: error?.message || "Unknown error",
            stack: error?.stack || "No stack trace",
            name: error?.name || "UnknownError",
            cause: error?.cause || "No cause",
            error,
        });
        res.status(500).json({ error: "Internal server error" });
    } finally {
        if (connection) connection.release();
    }
}
