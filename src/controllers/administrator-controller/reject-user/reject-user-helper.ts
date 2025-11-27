import { fileURLToPath } from 'url';
import fs from "fs/promises";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type Role = "jobseeker" | "individual-employer" | "business-employer" | "manpower-provider";

interface RoleConfig {
  table: string;
  idField: string;
  resetFields: string[];
  fileFields: string[];
}

const roleConfig: Record<Role, RoleConfig> = {
  "jobseeker": {
    table: "jobseeker",
    idField: "jobseeker_id",
    resetFields: [
      "full_name", "date_of_birth", "phone", "gender",
      "present_address", "permanent_address", "education", "skills",
      "government_id", "selfie_with_id", "nbi_barangay_clearance"
    ],
    fileFields: ["government_id", "selfie_with_id", "nbi_barangay_clearance"]
  },
  "individual-employer": {
    table: "individual_employer",
    idField: "individual_employer_id",
    resetFields: [
      "full_name", "date_of_birth", "phone", "gender",
      "present_address", "permanent_address",
      "government_id", "selfie_with_id", "nbi_barangay_clearance"
    ],
    fileFields: ["government_id", "selfie_with_id", "nbi_barangay_clearance"]
  },
  "business-employer": {
    table: "business_employer",
    idField: "business_employer_id",
    resetFields: [
      "business_name", "business_address", "industry", "business_size",
      "authorized_person", "authorized_person_id",
      "business_permit_BIR", "DTI", "business_establishment"
    ],
    fileFields: ["authorized_person_id", "business_permit_BIR", "DTI", "business_establishment"]
  },
  "manpower-provider": {
    table: "manpower_provider",
    idField: "manpower_provider_id",
    resetFields: [
      "agency_name", "agency_address", "agency_services",
      "agency_authorized_person", "dole_registration_number",
      "mayors_permit", "agency_certificate", "authorized_person_id"
    ],
    fileFields: ["dole_registration_number", "mayors_permit", "agency_certificate", "authorized_person_id"]
  }
};

export function getRoleConfig(role: Role): RoleConfig {
  if (!roleConfig[role]) {
    throw new Error(`Unsupported role: ${role}`);
  }
  return roleConfig[role];
}





