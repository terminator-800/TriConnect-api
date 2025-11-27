import type { Request, Response } from "express";
import type { PoolConnection } from "mysql2/promise";
import { format } from "date-fns";
import pool from "../../config/database-connection.js";
import dotenv from 'dotenv';
dotenv.config();
import logger from "../../config/logger.js";

function generateCloudinaryUrl(fileUrl: string | null): string | null {
    if (!fileUrl) return null;
    return fileUrl;
}

type Role =
    | "jobseeker"
    | "individual-employer"
    | "business-employer"
    | "manpower-provider"
    | "administrator";

interface SubmittedUserBase {
    user_id: number;
    email: string;
    role: Role;
    created_at: string | null;
    verified_at: string | null;
}

interface JobseekerUser extends SubmittedUserBase {
    full_name: string;
    date_of_birth: string | null;
    phone: string;
    gender: string;
    present_address: string;
    permanent_address: string;
    education: string;
    skills: string;
    government_id: string;
    selfie_with_id: string;
    nbi_barangay_clearance: string;
}

interface IndividualEmployerUser extends SubmittedUserBase {
    full_name: string;
    date_of_birth: string | null;
    phone: string;
    gender: string;
    present_address: string;
    permanent_address: string;
    government_id: string;
    selfie_with_id: string;
    nbi_barangay_clearance: string;
}

interface BusinessEmployerUser extends SubmittedUserBase {
    business_name: string;
    business_address: string;
    industry: string;
    business_size: string;
    authorized_person: string;
    authorized_person_id: string;
    business_permit_BIR: string;
    DTI: string;
    business_establishment: string;
}

interface ManpowerProviderUser extends SubmittedUserBase {
    agency_name: string;
    agency_address: string;
    agency_services: string;
    agency_authorized_person: string;
    authorized_person_id: string;
    dole_registration_number: string;
    mayors_permit: string;
    agency_certificate: string;
}

type SubmittedUser =
    | JobseekerUser
    | IndividualEmployerUser
    | BusinessEmployerUser
    | ManpowerProviderUser
    | SubmittedUserBase;

export const submittedUsers = async (req: Request, res: Response) => {

    if (req.user?.role !== "administrator") {
        logger.warn(`Unauthorized access attempt by user ID ${req.user?.user_id}.`);
        return res.status(403).json({ error: "Forbidden: Admins only." });
    }

    let connection: PoolConnection | undefined;

    try {
        connection = await pool.getConnection();
        const users: SubmittedUser[] = await getSubmittedUsers(connection);
        res.json(users);
    } catch (error: any) {
        logger.error("Failed to fetch submitted users from DB", {
            ip: req.ip,
            message: error?.message || "Unknown error",
            stack: error?.stack || "No stack trace",
            name: error?.name || "UnknownError",
            cause: error?.cause || "No cause",
            error,
        });
        res.status(500).json({ error: "Failed to fetch submitted users" });
    } finally {
        if (connection) connection.release();
    }
};

async function getSubmittedUsers(connection: PoolConnection): Promise<SubmittedUser[]> {
    try {
        const [rows]: any[] = await connection.query(`
        SELECT 
            u.user_id,
            u.email,
            u.role,
            u.created_at,
            u.verified_at,
            
            -- Jobseeker
            js.full_name AS js_full_name,
            js.date_of_birth AS js_dob,
            js.phone AS js_phone,
            js.gender AS js_gender,
            js.present_address AS js_present_address,
            js.permanent_address AS js_permanent_address,
            js.education AS js_education,
            js.skills AS js_skills,
            js.government_id AS js_government_id,
            js.selfie_with_id AS js_selfie_with_id,
            js.nbi_barangay_clearance AS js_nbi_barangay_clearance,

            -- Individual Employer
            ie.full_name AS ie_full_name,
            ie.date_of_birth AS ie_dob,
            ie.phone AS ie_phone,
            ie.gender AS ie_gender,
            ie.present_address AS ie_present_address,
            ie.permanent_address AS ie_permanent_address,
            ie.government_id AS ie_government_id,
            ie.selfie_with_id AS ie_selfie_with_id,
            ie.nbi_barangay_clearance AS ie_nbi_barangay_clearance,

            -- Business Employer
            be.business_name,
            be.business_address,
            be.industry,
            be.business_size,
            be.authorized_person,
            be.authorized_person_id AS business_authorized_person_id,
            be.business_permit_BIR AS business_permit_BIR,
            be.DTI AS DTI,
            be.business_establishment AS business_establishment,

            -- Manpower Provider
            mp.agency_name,
            mp.agency_address,
            mp.agency_services,
            mp.agency_authorized_person,
            mp.authorized_person_id AS mp_authorized_person_id,
            mp.dole_registration_number AS dole_registration_number,
            mp.mayors_permit AS mayors_permit,
            mp.agency_certificate AS agency_certificate

        FROM users u
            LEFT JOIN jobseeker js ON u.user_id = js.jobseeker_id AND u.role = 'jobseeker'
            LEFT JOIN individual_employer ie ON u.user_id = ie.individual_employer_id AND u.role = 'individual-employer'
            LEFT JOIN business_employer be ON u.user_id = be.business_employer_id AND u.role = 'business-employer'
            LEFT JOIN manpower_provider mp ON u.user_id = mp.manpower_provider_id AND u.role = 'manpower-provider'
        WHERE u.is_submitted = TRUE
            AND u.is_verified = FALSE
            AND u.is_rejected = FALSE
            AND u.verified_at IS NULL
            AND u.email != ''
        ORDER BY u.created_at DESC;
  `);

        return rows.map((user: any) => {
            const base: SubmittedUserBase = {
                user_id: user.user_id,
                email: user.email,
                role: user.role,
                created_at: user.created_at
                    ? format(new Date(user.created_at), "MMMM dd, yyyy 'at' hh:mm a")
                    : null,
                verified_at: user.verified_at
                    ? format(new Date(user.verified_at), "MMMM dd, yyyy 'at' hh:mm a")
                    : null,
            };

            switch (user.role) {
                case "jobseeker":
                    return {
                        ...base,
                        full_name: user.js_full_name,
                        date_of_birth: user.js_dob ? format(new Date(user.js_dob), "MMMM dd, yyyy") : null,
                        phone: user.js_phone,
                        gender: user.js_gender,
                        present_address: user.js_present_address,
                        permanent_address: user.js_permanent_address,
                        education: user.js_education,
                        skills: user.js_skills,
                        government_id: generateCloudinaryUrl(user.js_government_id),
                        selfie_with_id: generateCloudinaryUrl(user.js_selfie_with_id),
                        nbi_barangay_clearance: generateCloudinaryUrl(user.js_nbi_barangay_clearance),
                    } as JobseekerUser;

                case "individual-employer":
                    return {
                        ...base,
                        full_name: user.ie_full_name,
                        date_of_birth: user.ie_dob ? format(new Date(user.ie_dob), "MMMM dd, yyyy") : null,
                        phone: user.ie_phone,
                        gender: user.ie_gender,
                        present_address: user.ie_present_address,
                        permanent_address: user.ie_permanent_address,
                        government_id: generateCloudinaryUrl(user.ie_government_id),
                        selfie_with_id: generateCloudinaryUrl(user.ie_selfie_with_id),
                        nbi_barangay_clearance: generateCloudinaryUrl(user.ie_nbi_barangay_clearance),
                    } as IndividualEmployerUser;

                case "business-employer":
                    return {
                        ...base,
                        business_name: user.business_name,
                        business_address: user.business_address,
                        industry: user.industry,
                        business_size: user.business_size,
                        authorized_person: user.authorized_person,
                        authorized_person_id: generateCloudinaryUrl(user.business_authorized_person_id),
                        business_permit_BIR: generateCloudinaryUrl(user.business_permit_BIR),
                        DTI: generateCloudinaryUrl(user.DTI),
                        business_establishment: generateCloudinaryUrl(user.business_establishment),

                    } as BusinessEmployerUser;

                case "manpower-provider":
                    return {
                        ...base,
                        agency_name: user.agency_name,
                        agency_address: user.agency_address,
                        agency_services: user.agency_services,
                        agency_authorized_person: user.agency_authorized_person,
                        authorized_person_id: generateCloudinaryUrl(user.mp_authorized_person_id),
                        dole_registration_number: generateCloudinaryUrl(user.dole_registration_number),
                        mayors_permit: generateCloudinaryUrl(user.mayors_permit),
                        agency_certificate: generateCloudinaryUrl(user.agency_certificate),
                    } as ManpowerProviderUser;

                default:
                    return base;
            }
        });
    } catch (error) {
        throw error;
    }
}

