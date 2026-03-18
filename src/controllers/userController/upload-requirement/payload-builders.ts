// payload-builders.ts
// SRP: Each builder is responsible for constructing only its role's payload
// OCP: New roles can be added by creating a new builder without modifying existing ones
// LSP: All builders implement the same interface and are interchangeable

import { uploadToCloudinary } from '../../../utils/upload-to-cloudinary.js';

interface MulterFiles {
  [fieldname: string]: Express.Multer.File[];
}

// ISP: Narrow interface — builders only need files + body, nothing else
export interface PayloadBuilder {
  build(body: Record<string, any>, files: MulterFiles): Promise<Record<string, any>>;
}

// ---- Helpers ----

const capitalizeFirst = (str: string): string =>
  str.trim().toLowerCase().replace(/^./, (c) => c.toUpperCase());

const uploadFile = async (files: MulterFiles, field: string): Promise<string | null> =>
  files?.[field]?.[0] ? await uploadToCloudinary(files[field][0].path) : null;

// ---- Builders ----

export class JobseekerPayloadBuilder implements PayloadBuilder {
  async build(body: Record<string, any>, files: MulterFiles) {
    return {
      full_name: body.full_name?.trim(),
      date_of_birth: body.date_of_birth,
      phone: body.contact_number?.trim(),
      gender: body.gender ? capitalizeFirst(body.gender) : null,
      present_address: body.present_address?.trim(),
      permanent_address: body.permanent_address?.trim(),
      education: body.education?.trim(),
      skills: body.skills?.trim(),
      government_id: await uploadFile(files, 'government_id'),
      selfie_with_id: await uploadFile(files, 'selfie_with_id'),
      nbi_barangay_clearance: await uploadFile(files, 'nbi_barangay_clearance'),
    };
  }
}

export class IndividualEmployerPayloadBuilder implements PayloadBuilder {
  async build(body: Record<string, any>, files: MulterFiles) {
    return {
      full_name: body.full_name?.trim(),
      date_of_birth: body.date_of_birth,
      phone: body.phone?.trim(),
      gender: body.gender ? capitalizeFirst(body.gender) : null,
      present_address: body.present_address?.trim(),
      permanent_address: body.permanent_address?.trim(),
      government_id: await uploadFile(files, 'government_id'),
      selfie_with_id: await uploadFile(files, 'selfie_with_id'),
      nbi_barangay_clearance: await uploadFile(files, 'nbi_barangay_clearance'),
    };
  }
}

export class BusinessEmployerPayloadBuilder implements PayloadBuilder {
  async build(body: Record<string, any>, files: MulterFiles) {
    return {
      business_name: body.business_name?.trim(),
      business_address: body.business_address?.trim(),
      industry: body.industry?.trim(),
      business_size: body.business_size?.trim(),
      authorized_person: body.authorized_person?.trim(),
      authorized_person_id: await uploadFile(files, 'authorized_person_id'),
      business_permit_BIR: await uploadFile(files, 'business_permit_BIR'),
      DTI: await uploadFile(files, 'DTI'),
      business_establishment: await uploadFile(files, 'business_establishment'),
    };
  }
}

export class ManpowerProviderPayloadBuilder implements PayloadBuilder {
  async build(body: Record<string, any>, files: MulterFiles) {
    return {
      agency_name: body.agency_name?.trim(),
      agency_address: body.agency_address?.trim(),
      agency_authorized_person: body.agency_authorized_person?.trim(),
      agency_services: body.agency_services?.trim(),
      dole_registration_number: await uploadFile(files, 'dole_registration_number'),
      mayors_permit: await uploadFile(files, 'mayors_permit'),
      authorized_person_id: await uploadFile(files, 'authorized_person_id'),
      agency_certificate: await uploadFile(files, 'agency_certificate'),
    };
  }
}