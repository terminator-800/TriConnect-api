import type { PoolConnection, ResultSetHeader } from "mysql2/promise";
import { ROLE } from '../../../utils/roles.js';

interface BasePayload {
    role: (typeof ROLE)[keyof typeof ROLE];
    user_id: number;
}

export interface JobseekerPayload extends BasePayload {
    role: "jobseeker";
    full_name: string;
    date_of_birth: string;
    phone: string;
    gender: string;
    present_address: string;
    permanent_address: string;
    education: string;
    skills: string;
    government_id: string;
    selfie_with_id: string;
    nbi_barangay_clearance: string;
    government_id_public_id: string;
    selfie_with_id_public_id: string;
    nbi_barangay_clearance_public_id: string;
}

export interface IndividualEmployerPayload extends BasePayload {
    role: "individual-employer";
    full_name: string;
    date_of_birth: string;
    phone: string;
    gender: string;
    present_address: string;
    permanent_address: string;
    government_id: string;
    selfie_with_id: string;
    nbi_barangay_clearance: string;
    government_id_public_id: string;
    selfie_with_id_public_id: string;
    nbi_barangay_clearance_public_id: string;
}

export interface BusinessEmployerPayload extends BasePayload {
    role: "business-employer";
    business_name: string;
    business_address: string;
    industry: string;
    business_size: string;
    authorized_person: string;
    authorized_person_id: string;
    business_permit_BIR: string;
    DTI: string;
    business_establishment: string;
    authorized_person_id_public_id: string;
    business_permit_BIR_public_id: string;
    DTI_public_id: string;
    business_establishment_public_id: string;
}

export interface ManpowerProviderPayload extends BasePayload {
    role: "manpower-provider";
    agency_name: string;
    agency_address: string;
    agency_services: string;
    agency_authorized_person: string;
    authorized_person_id: string;
    dole_registration_number: string;
    mayors_permit: string;
    agency_certificate: string;
    dole_registration_number_public_id: string;
    mayors_permit_public_id: string;
    authorized_person_id_public_id: string;
    agency_certificate_public_id: string;
}

type Payload =
    | JobseekerPayload
    | IndividualEmployerPayload
    | BusinessEmployerPayload
    | ManpowerProviderPayload;


export async function uploadUserRequirement(
    connection: PoolConnection,
    payload: Payload) {

    try {
        switch (payload.role) {
            case 'jobseeker':
                await connection.execute<ResultSetHeader>(
                    `UPDATE jobseeker SET 
                        full_name = ?, 
                        date_of_birth = ?, 
                        phone = ?, 
                        gender = ?, 
                        present_address = ?, 
                        permanent_address = ?, 
                        education = ?, 
                        skills = ?, 
                        government_id = ?, 
                        selfie_with_id = ?, 
                        nbi_barangay_clearance = ?
                    WHERE jobseeker_id = ?`,
                    [
                        payload.full_name,
                        payload.date_of_birth,
                        payload.phone,
                        payload.gender,
                        payload.present_address,
                        payload.permanent_address,
                        payload.education,
                        payload.skills,
                        payload.government_id,
                        payload.selfie_with_id,
                        payload.nbi_barangay_clearance,
                        payload.user_id
                    ]
                );
                break;

            case 'individual-employer':
                await connection.execute<ResultSetHeader>(
                    `UPDATE individual_employer SET 
                        full_name = ?, 
                        date_of_birth = ?, 
                        phone = ?, 
                        gender = ?, 
                        present_address = ?, 
                        permanent_address = ?, 
                        government_id = ?, 
                        selfie_with_id = ?, 
                        nbi_barangay_clearance = ?
                    WHERE individual_employer_id = ?`,
                    [
                        payload.full_name,
                        payload.date_of_birth,
                        payload.phone,
                        payload.gender,
                        payload.present_address,
                        payload.permanent_address,
                        payload.government_id,
                        payload.selfie_with_id,
                        payload.nbi_barangay_clearance,
                        payload.user_id,
                    ]
                );
                break;

            case 'business-employer':
                await connection.execute<ResultSetHeader>(
                    `UPDATE business_employer SET 
                        business_name = ?, 
                        business_address = ?, 
                        industry = ?, 
                        business_size = ?, 
                        authorized_person = ?, 
                        authorized_person_id = ?, 
                        business_permit_BIR = ?, 
                        DTI = ?, 
                        business_establishment = ?
                    WHERE business_employer_id = ?`,
                    [
                        payload.business_name,
                        payload.business_address,
                        payload.industry,
                        payload.business_size,
                        payload.authorized_person,
                        payload.authorized_person_id,
                        payload.business_permit_BIR,
                        payload.DTI,
                        payload.business_establishment,
                        payload.user_id,
                    ]
                );
                break;

            case 'manpower-provider':
                await connection.execute<ResultSetHeader>(
                    `UPDATE manpower_provider SET 
                        agency_name = ?, 
                        agency_address = ?, 
                        agency_services = ?, 
                        agency_authorized_person = ?, 
                        dole_registration_number = ?, 
                        mayors_permit = ?, 
                        agency_certificate = ?, 
                        authorized_person_id = ?
                    WHERE manpower_provider_id = ?`,
                    [
                        payload.agency_name,
                        payload.agency_address,
                        payload.agency_services,
                        payload.agency_authorized_person,
                        payload.dole_registration_number,
                        payload.mayors_permit,
                        payload.agency_certificate,
                        payload.authorized_person_id,
                        payload.user_id,
                    ]
                );
                break;

            default:
                throw new Error("Unknown role during requirement upload");
        }

        await connection.execute<ResultSetHeader>(
            `UPDATE users 
             SET 
                is_submitted = TRUE, 
                is_verified = FALSE, 
                is_rejected = CASE 
                    WHEN is_rejected = TRUE THEN FALSE 
                    ELSE is_rejected 
                END 
             WHERE user_id = ?`,
            [payload.user_id]
        );

    } catch (error) {
        throw error;
    }
}
