import type { Request, Response } from "express";
import { uploadUserRequirement } from "./insert-requirement.js";
import type { PoolConnection } from "mysql2/promise";
import { uploadToCloudinary } from "../../../utils/upload-to-cloudinary.js";
import { getUserInfo } from "./get-user-info.js";
import { ROLE } from "../../../utils/roles.js";
import logger from "../../../config/logger.js";
import pool from "../../../config/database-connection.js";
import jwt from "jsonwebtoken";

// Simple JWT payload type
interface JwtPayload {
  user_id: number;
  email: string;
  role: keyof typeof ROLE;
  is_registered: boolean | number;
}

interface MulterFiles {
  [fieldname: string]: Express.Multer.File[];
}

export const uploadRequirement = async (req: Request, res: Response) => {
  let connection: PoolConnection | undefined;
  const ip = req.ip;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const token = req.cookies?.token;

    if (!token) {
      logger.warn("No JWT token provided", { ip });
      return res.status(401).json({ message: "No token provided" })
    };

    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    } catch (err: any) {
      logger.warn("Invalid or expired JWT token", { ip, error: err });
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    const { user_id, email, role, is_registered } = decoded;

    if (!user_id || !email || !role || !is_registered) {
      logger.warn("Invalid JWT payload", { user_id, email, role, is_registered, ip });
      return res.status(400).json({ message: "Invalid token payload" });
    }

    const allowedRoles = [
      ROLE.JOBSEEKER,
      ROLE.INDIVIDUAL_EMPLOYER,
      ROLE.BUSINESS_EMPLOYER,
      ROLE.MANPOWER_PROVIDER,
    ];

    if (!allowedRoles.includes(role)) {
      logger.warn("Unauthorized role attempted to upload requirement", { role, user_id, ip });
      return res.status(403).json({ message: "Unauthorized role" });
    }

    const matchedUser = await getUserInfo(connection, user_id);

    if (!matchedUser || matchedUser.email !== email || matchedUser.role !== role) {
      logger.warn("User validation failed", { user_id, email, role, ip });
      return res.status(403).json({ message: "User validation failed" });
    }
    const files = req.files as MulterFiles;

    let payload: any = { user_id, role };

    switch (role) {
      case ROLE.JOBSEEKER:

        payload = {
          ...payload,
          full_name: req.body.full_name?.trim(),
          date_of_birth: req.body.date_of_birth,
          phone: req.body.contact_number?.trim(),
          gender: req.body.gender
            ? req.body.gender.trim().toLowerCase().replace(/^./, (c: string) => c.toUpperCase())
            : null,
          present_address: req.body.present_address?.trim(),
          permanent_address: req.body.permanent_address?.trim(),
          education: req.body.education?.trim(),
          skills: req.body.skills?.trim(),
          government_id: files?.government_id?.[0]
            ? await uploadToCloudinary(files.government_id[0]?.path)
            : null,

          selfie_with_id: files?.selfie_with_id?.[0]
            ? await uploadToCloudinary(files.selfie_with_id[0]?.path)
            : null,

          nbi_barangay_clearance: files?.nbi_barangay_clearance?.[0]
            ? await uploadToCloudinary(files.nbi_barangay_clearance[0]?.path)
            : null
        };
        break;

      case ROLE.INDIVIDUAL_EMPLOYER:
        payload = {
          ...payload,
          full_name: req.body.full_name?.trim(),
          date_of_birth: req.body.date_of_birth,
          phone: req.body.phone?.trim(),
          gender: req.body.gender
            ? req.body.gender.trim().toLowerCase().replace(/^./, (c: string) => c.toUpperCase())
            : null,
          present_address: req.body.present_address?.trim(),
          permanent_address: req.body.permanent_address?.trim(),
          government_id: files?.government_id?.[0]
            ? await uploadToCloudinary(files.government_id[0]?.path)
            : null,

          selfie_with_id: files?.selfie_with_id?.[0]
            ? await uploadToCloudinary(files.selfie_with_id[0]?.path)
            : null,

          nbi_barangay_clearance: files?.nbi_barangay_clearance?.[0]
            ? await uploadToCloudinary(files.nbi_barangay_clearance[0]?.path)
            : null,
        };
        break;

      case ROLE.BUSINESS_EMPLOYER:
        payload = {
          ...payload,
          business_name: req.body.business_name?.trim(),
          business_address: req.body.business_address?.trim(),
          industry: req.body.industry?.trim(),
          business_size: req.body.business_size?.trim(),
          authorized_person: req.body.authorized_person?.trim(),
          authorized_person_id: files?.authorized_person_id?.[0]
            ? await uploadToCloudinary(files.authorized_person_id[0]?.path)
            : null,

          business_permit_BIR: files?.business_permit_BIR?.[0]
            ? await uploadToCloudinary(files.business_permit_BIR[0]?.path)
            : null,

          DTI: files?.DTI?.[0]
            ? await uploadToCloudinary(files.DTI[0]?.path)
            : null,

          business_establishment: files?.business_establishment?.[0]
            ? await uploadToCloudinary(files.business_establishment[0]?.path)
            : null,
        };
        break;

      case ROLE.MANPOWER_PROVIDER:
        payload = {
          ...payload,
          agency_name: req.body.agency_name?.trim(),
          agency_address: req.body.agency_address?.trim(),
          agency_authorized_person: req.body.agency_authorized_person?.trim(),
          agency_services: req.body.agency_services?.trim(),
          dole_registration_number: files?.dole_registration_number?.[0]
            ? await uploadToCloudinary(files.dole_registration_number[0]?.path)
            : null,

          mayors_permit: files?.mayors_permit?.[0]
            ? await uploadToCloudinary(files.mayors_permit[0]?.path)
            : null,

          authorized_person_id: files?.authorized_person_id?.[0]
            ? await uploadToCloudinary(files.authorized_person_id[0]?.path)
            : null,

          agency_certificate: files?.agency_certificate?.[0]
            ? await uploadToCloudinary(files.agency_certificate[0]?.path)
            : null
        };
        break;

      default:
        logger.warn("Invalid role encountered", { role, user_id, ip });
        return res.status(400).json({ message: "Invalid role" });
    }

    await uploadUserRequirement(connection, payload);
    await connection.commit();
    return res.status(200).json({ message: `${role} requirements uploaded successfully` });
  } catch (error: any) {
    await connection?.rollback();
    logger.error("Failed to process requirement upload", {
      ip,
      name: error?.name || "UnknownError",
      message: error?.message || "Unknown error during requirement upload",
      stack: error?.stack || "No stack trace",
      cause: error?.cause || "No cause",
      error: error,
    });
    return res.status(500).json({ message: "Server error" });
  } finally {
      if (connection) connection.release();
  }
};
