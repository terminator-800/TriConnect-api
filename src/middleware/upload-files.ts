import multer from 'multer';
import type { StorageEngine, FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/express/auth.js';
import { ROLE } from '../utils/roles.js';
import type { CustomRequest } from '../types/express/auth.js';
type Role = typeof ROLE[keyof typeof ROLE];



// === Directory Setup ===
const baseUploadDir = './uploads';
const chatUploadDir = path.join(baseUploadDir, 'chat');
const reportUploadDir = path.join(baseUploadDir, 'reports');
const profileUploadDir = path.join(baseUploadDir, 'profile');

const roles: Role[] = [
    ROLE.JOBSEEKER,
    ROLE.BUSINESS_EMPLOYER,
    ROLE.INDIVIDUAL_EMPLOYER,
    ROLE.MANPOWER_PROVIDER,
];

// 1. Base upload folder
if (!fs.existsSync(baseUploadDir)) fs.mkdirSync(baseUploadDir, { recursive: true });

// 2. Role folders + unknown
roles.forEach(role => {
    const roleDir = path.join(baseUploadDir, role);
    if (!fs.existsSync(roleDir)) fs.mkdirSync(roleDir, { recursive: true });
    const unknownDir = path.join(roleDir, '0_unknown');
    if (!fs.existsSync(unknownDir)) fs.mkdirSync(unknownDir, { recursive: true });
});

// 3. Chat, report & profile folders
[chatUploadDir, reportUploadDir, profileUploadDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// === File Filter ===
const imageOnlyFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedMimeTypes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error('Only image or document files (PDF, DOC, DOCX) are allowed.'));
    }
    cb(null, true);
};

// === Sanitize folder names ===
const sanitizeFolderName = (name: string) => name.replace(/[^a-zA-Z0-9 _.-]/g, '').trim();

// === Role-based Storage Factory ===
const makeStorage = (role: Role, nameField: string, fallbackName: string): StorageEngine =>
    multer.diskStorage({
        destination: (req: Request, _file, cb) => {
            try {
                const token = req.cookies?.token;
                if (!token) return cb(new Error('Unauthorized: No token provided'), "");
                const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthenticatedUser;
                const userId = decoded.user_id;
                const rawName = req.body[nameField] || fallbackName;
                const safeName = sanitizeFolderName(rawName);
                const folderPath = path.join(baseUploadDir, role, String(userId), safeName);
                fs.mkdirSync(folderPath, { recursive: true });
                cb(null, folderPath);
            } catch (err) {
                cb(new Error('Invalid or expired token'), undefined as unknown as string);
            }
        },
        filename: (_req, file, cb) => {
            const uniqueName = `${Date.now()}${path.extname(file.originalname)}`;
            cb(null, uniqueName);
        }
    });







// === Chat Upload Storage ===
const chatStorage = multer.diskStorage({
    destination: (req: Request, _file, cb) => {
        try {
            const { conversation_id, receiver_id } = req.body;
            const sender_id = req.user?.user_id;
            if (!sender_id || !receiver_id) return cb(new Error('Missing sender_id or receiver_id'), undefined as unknown as string);

            const destinationDir = conversation_id
                ? path.join(chatUploadDir, conversation_id)
                : path.join(chatUploadDir, `${sender_id}_${receiver_id}`);

            fs.mkdirSync(destinationDir, { recursive: true });
            cb(null, destinationDir);
        } catch (err) {
            cb(new Error('Failed to determine destination folder'), undefined as unknown as string);
        }
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const chatImageUpload = multer({ storage: chatStorage, fileFilter: imageOnlyFilter }).array('files', 10);








// === Report Upload Storage ===
let sharedTempFolderId: string | null = null;

const reportStorage = multer.diskStorage({
    destination: (req: Request, _file, cb) => {
        const customReq = req as CustomRequest;
        if (!sharedTempFolderId) sharedTempFolderId = uuidv4();
        customReq.tempFolderId = sharedTempFolderId;
        const folderPath = path.join(reportUploadDir, `temp-${sharedTempFolderId}`);
        fs.mkdirSync(folderPath, { recursive: true });
        cb(null, folderPath);
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const reportUpload = multer({ storage: reportStorage, fileFilter: imageOnlyFilter }).array('proof_files', 5);






// === Role-specific Upload Middleware ===
const jobseekerUpload = multer({ storage: makeStorage(ROLE.JOBSEEKER, 'full_name', 'unknown_jobseeker'), fileFilter: imageOnlyFilter });
const businessEmployerUpload = multer({ storage: makeStorage(ROLE.BUSINESS_EMPLOYER, 'business_name', 'unknown_business'), fileFilter: imageOnlyFilter });
const individualEmployerUpload = multer({ storage: makeStorage(ROLE.INDIVIDUAL_EMPLOYER, 'full_name', 'unknown_individual'), fileFilter: imageOnlyFilter });
const manpowerProviderUpload = multer({ storage: makeStorage(ROLE.MANPOWER_PROVIDER, 'agency_name', 'unknown_agency'), fileFilter: imageOnlyFilter });

// === Fields per Role ===
const uploadJobseekerFiles = jobseekerUpload.fields([
    { name: 'government_id', maxCount: 1 },
    { name: 'selfie_with_id', maxCount: 1 },
    { name: 'nbi_barangay_clearance', maxCount: 1 },
]);

const uploadBusinessEmployerFiles = businessEmployerUpload.fields([
    { name: 'authorized_person_id', maxCount: 1 },
    { name: 'business_permit_BIR', maxCount: 1 },
    { name: 'DTI', maxCount: 1 },
    { name: 'business_establishment', maxCount: 1 },
]);

const uploadIndividualEmployerFiles = individualEmployerUpload.fields([
    { name: 'government_id', maxCount: 1 },
    { name: 'selfie_with_id', maxCount: 1 },
    { name: 'nbi_barangay_clearance', maxCount: 1 },
]);

const uploadManpowerProviderFiles = manpowerProviderUpload.fields([
    { name: 'dole_registration_number', maxCount: 1 },
    { name: 'mayors_permit', maxCount: 1 },
    { name: 'agency_certificate', maxCount: 1 },
    { name: 'authorized_person_id', maxCount: 1 },
]);







// === Profile Upload Storage ===
const profileStorage = multer.diskStorage({
    destination: (req: Request, _file, cb) => {
        try {
            const userId = (req.user as AuthenticatedUser)?.user_id;
            if (!userId) return cb(new Error("Unauthorized: No user ID"), "");

            // Correct path: uploads/profile/<userId>
            const folderPath = path.join(profileUploadDir, String(userId));
            fs.mkdirSync(folderPath, { recursive: true });

            cb(null, folderPath);
        } catch (err) {
            cb(new Error("Failed to create profile folder"), undefined as unknown as string);
        }
    },
    filename: (_req, file, cb) => {
        const uniqueName = `profile_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});


const profileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed for profile picture!"));
    }
};

// === Profile Upload Middleware ===
const changeUserProfile = multer({
    storage: profileStorage,
    fileFilter: profileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 2MB
    },
}).single("profile");


// === Exported Uploads ===
export {
    uploadJobseekerFiles,
    uploadBusinessEmployerFiles,
    uploadIndividualEmployerFiles,
    uploadManpowerProviderFiles,
    chatImageUpload,
    reportUpload,
    changeUserProfile
};
