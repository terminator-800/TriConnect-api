import { getAdministratorProfile } from './get-administrator.js';
import { getJobseekerProfile } from './get-jobseeker.js';
import { getBusinessEmployerProfile } from './get-business-employer.js';
import { getIndividualEmployerProfile } from './get-individual-employer.js';
import { getManpowerProviderProfile } from './get-manpower-provider.js';
import type { Request, Response } from 'express';
import type { PoolConnection } from 'mysql2/promise';
import type { AuthenticatedUser } from '../../../types/express/auth.js';
import { ROLE } from '../../../utils/roles.js';
import logger from '../../../config/logger.js';
import pool from '../../../config/database-connection.js';

// --- User profiles ---
export interface JobseekerProfile {
  role: typeof ROLE.JOBSEEKER;
  user_id: number;
  full_name: string;
  date_of_birth: string;
  phone: string;
  gender: string;
  present_address: string;
  permanent_address: string;
  education?: string;
  skills?: string[];
  government_id?: string;
  selfie_with_id?: string;
  nbi_barangay_clearance?: string;
}

export interface BusinessEmployerProfile {
  role: typeof ROLE.BUSINESS_EMPLOYER;
  user_id: number;
  business_name: string;
  business_address: string;
  industry?: string;
  business_size?: string;
  authorized_person: string;
  authorized_person_id?: string;
  business_permit_BIR?: string;
  DTI?: string;
  business_establishment?: string;
}

export interface IndividualEmployerProfile {
  role: typeof ROLE.INDIVIDUAL_EMPLOYER;
  user_id: number;
  full_name: string;
  date_of_birth: string;
  phone: string;
  gender: string;
  present_address: string;
  permanent_address: string;
  government_id?: string;
  selfie_with_id?: string;
  nbi_barangay_clearance?: string;
}

export interface ManpowerProviderProfile {
  role: typeof ROLE.MANPOWER_PROVIDER;
  user_id: number;
  agency_name: string;
  agency_address: string;
  agency_services?: string;
  agency_authorized_person: string;
  authorized_person_id?: string;
  dole_registration_number?: string;
  mayors_permit?: string;
  agency_certificate?: string;
}

export interface AdministratorProfile {
  role: typeof ROLE.ADMINISTRATOR;
  user_id: number;
  email: string;
}

export type UserProfile =
  | JobseekerProfile
  | BusinessEmployerProfile
  | IndividualEmployerProfile
  | ManpowerProviderProfile
  | AdministratorProfile;

// --- Allowed roles ---
const allowedRoles: AuthenticatedUser['role'][] = [
  ROLE.JOBSEEKER,
  ROLE.BUSINESS_EMPLOYER,
  ROLE.INDIVIDUAL_EMPLOYER,
  ROLE.MANPOWER_PROVIDER,
  ROLE.ADMINISTRATOR,
];

export const getUserProfile = async (
  request: Request,
  response: Response
): Promise<Response<UserProfile | { error: string }>> => {
  let connection: PoolConnection | undefined;

  try {
    connection = await pool.getConnection();
    const ip = request.ip;

    if (!request.user) {
      logger.warn("User not found in request", { ip });
      return response.status(403).json({ error: 'Forbidden: User not found in request' });
    }

    const { user_id, role, email, is_registered } = request.user;

    if (!user_id || !role || !email) {
      logger.warn("Invalid user data in token", { user_id, role, email, ip });
      return response.status(403).json({ error: 'Forbidden: Invalid user data in token' });
    }

    if (!allowedRoles.includes(role)) {
      logger.warn("Unauthorized role tried to access profile", { role, user_id, ip });
      return response.status(403).json({ error: 'Forbidden: Unauthorized role' });
    }

    if (!is_registered) {
      logger.warn("Unregistered user tried to access profile", { user_id, ip });
      return response.status(403).json({ error: 'User is not registered' });
    }

    let userProfile: UserProfile | null = null;

    switch (role) {
      case ROLE.JOBSEEKER:
        userProfile = await getJobseekerProfile(connection, user_id);
        break;
      case ROLE.BUSINESS_EMPLOYER:
        userProfile = await getBusinessEmployerProfile(connection, user_id);
        break;
      case ROLE.INDIVIDUAL_EMPLOYER:
        userProfile = await getIndividualEmployerProfile(connection, user_id);
        break;
      case ROLE.MANPOWER_PROVIDER:
        userProfile = await getManpowerProviderProfile(connection, user_id);
        break;
      case ROLE.ADMINISTRATOR:
        userProfile = await getAdministratorProfile(connection, user_id);
        break;
      default:
        logger.warn("Unsupported role for profile access", { role, user_id, ip });
        return response.status(403).json({ error: 'Unsupported role for profile access' });
    }

    if (!userProfile) {
      logger.warn("Profile not found", { user_id, role, ip });
      return response.status(404).json({ error: 'Profile not found' });
    }

    return response.status(200).json(userProfile);
  } catch (error: any) {
    logger.error("Failed to fetch user profile", {
      ip: request.ip,
      name: error?.name || "UnknownError",
      message: error?.message || "Unknown error",
      stack: error?.stack || "No stack trace",
      cause: error?.cause || "No cause",
      error,
    });
    return response.status(500).json({ error: 'Internal server error' });
  } finally {
      if (connection) connection.release();
  }
};
