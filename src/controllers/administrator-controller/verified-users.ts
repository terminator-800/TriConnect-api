import type { CustomRequest } from "../../types/express/auth.js";
import type { Response } from "express";
import { format } from "date-fns";
import { ROLE } from "../../utils/roles.js";
import pool from "../../config/database-connection.js";
import logger from "../../config/logger.js";

type Role = typeof ROLE[keyof typeof ROLE];

interface BaseUser {
    user_id: number;
    role: Role;
    email: string;
    verified_at: string | null;
    profile?: string | null;
}

interface JobseekerUser extends BaseUser {
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

interface IndividualEmployerUser extends BaseUser {
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

interface BusinessEmployerUser extends BaseUser {
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

interface ManpowerProviderUser extends BaseUser {
    agency_name: string;
    agency_address: string;
    agency_services: string;
    agency_authorized_person: string;
    authorized_person_id: string;
    dole_registration_number: string;
    mayors_permit: string;
    agency_certificate: string;
}

type VerifiedUser =
    | JobseekerUser
    | IndividualEmployerUser
    | BusinessEmployerUser
    | ManpowerProviderUser
    | BaseUser;

export const verifiedUsers = async (req: CustomRequest, res: Response) => {
    let connection: Awaited<ReturnType<typeof pool.getConnection>> | undefined;

    try {
        const role = req.user?.role;

        if (role !== ROLE.ADMINISTRATOR) {
            logger.warn(`Unauthorized attempt by user ID ${req.user?.user_id} to fetch verified users.`);
            return res.status(403).json({ message: "Forbidden: Administrator only" });
        }

        connection = await pool.getConnection();

        const [rows] = await connection.query<any[]>(`
            SELECT 
                u.user_id, u.role, u.email, u.verified_at,
                 u.profile,
                -- Jobseeker fields
                js.full_name AS full_name, js.date_of_birth, js.phone, js.gender,
                js.present_address, js.permanent_address, js.education, js.skills,
                js.government_id, js.selfie_with_id, js.nbi_barangay_clearance,

                -- Individual employer fields
                ie.full_name AS individual_full_name, ie.date_of_birth AS individual_dob,
                ie.phone AS individual_phone, ie.gender AS individual_gender,
                ie.present_address AS individual_present_address,
                ie.permanent_address AS individual_permanent_address,
                ie.government_id AS individual_government_id,
                ie.selfie_with_id AS individual_selfie_with_id,
                ie.nbi_barangay_clearance AS individual_clearance,

                -- Business employer fields
                be.business_name, be.business_address, be.industry, be.business_size,
                be.authorized_person, be.authorized_person_id,
                be.business_permit_BIR, be.DTI, be.business_establishment,

                -- Manpower provider fields
                mp.agency_name, mp.agency_address, mp.agency_services,
                mp.agency_authorized_person, mp.authorized_person_id AS mp_authorized_person_id,
                mp.dole_registration_number, mp.mayors_permit, mp.agency_certificate

            FROM users u
            LEFT JOIN jobseeker js ON u.user_id = js.jobseeker_id
            LEFT JOIN individual_employer ie ON u.user_id = ie.individual_employer_id
            LEFT JOIN business_employer be ON u.user_id = be.business_employer_id
            LEFT JOIN manpower_provider mp ON u.user_id = mp.manpower_provider_id
            WHERE u.is_verified = 1 AND u.role != ?
        `, [ROLE.ADMINISTRATOR]);

        const formatted: VerifiedUser[] = rows.map(user => {
            const base: BaseUser = {
                user_id: user.user_id,
                role: user.role,
                email: user.email,
                verified_at: user.verified_at ? format(new Date(user.verified_at), "MMMM dd, yy 'at' hh:mm a") : null,
                profile: user.profile
            };

            if (user.role === ROLE.JOBSEEKER) {
                return {
                    ...base,
                    full_name: user.full_name,
                    date_of_birth: user.date_of_birth ? format(new Date(user.date_of_birth), "MMMM dd, yyyy") : null,
                    phone: user.phone,
                    gender: user.gender,
                    present_address: user.present_address,
                    permanent_address: user.permanent_address,
                    education: user.education,
                    skills: user.skills,
                    government_id: user.government_id,
                    selfie_with_id: user.selfie_with_id,
                    nbi_barangay_clearance: user.nbi_barangay_clearance
                } as JobseekerUser;
            }

            if (user.role === ROLE.INDIVIDUAL_EMPLOYER) {
                return {
                    ...base,
                    full_name: user.individual_full_name,
                    date_of_birth: user.individual_dob ? format(new Date(user.individual_dob), "MMMM dd, yyyy") : null,
                    phone: user.individual_phone,
                    gender: user.individual_gender,
                    present_address: user.individual_present_address,
                    permanent_address: user.individual_permanent_address,
                    government_id: user.individual_government_id,
                    selfie_with_id: user.individual_selfie_with_id,
                    nbi_barangay_clearance: user.individual_clearance
                } as IndividualEmployerUser;
            }

            if (user.role === ROLE.BUSINESS_EMPLOYER) {
                return {
                    ...base,
                    business_name: user.business_name,
                    business_address: user.business_address,
                    industry: user.industry,
                    business_size: user.business_size,
                    authorized_person: user.authorized_person,
                    authorized_person_id: user.authorized_person_id,
                    business_permit_BIR: user.business_permit_BIR,
                    DTI: user.DTI,
                    business_establishment: user.business_establishment
                } as BusinessEmployerUser;
            }

            if (user.role === ROLE.MANPOWER_PROVIDER) {
                return {
                    ...base,
                    agency_name: user.agency_name,
                    agency_address: user.agency_address,
                    agency_services: user.agency_services,
                    agency_authorized_person: user.agency_authorized_person,
                    authorized_person_id: user.mp_authorized_person_id,
                    dole_registration_number: user.dole_registration_number,
                    mayors_permit: user.mayors_permit,
                    agency_certificate: user.agency_certificate
                } as ManpowerProviderUser;
            }

            return base;
        });

        res.json(formatted);

    } catch (error: any) {
        logger.error("Unexpected error in verifiedUsers", {
            ip: req.ip,
            message: error?.message || "Unknown error",
            stack: error?.stack || "No stack trace",
            name: error?.name || "UnknownError",
            cause: error?.cause || "No cause",
            error,
        });
        res.status(500).json({ message: "Failed to get verified users." });
    } finally {
        if (connection) connection.release();
    }
};
