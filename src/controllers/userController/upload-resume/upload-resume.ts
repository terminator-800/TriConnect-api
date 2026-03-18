import type { Response } from 'express';
import fs from 'fs';
import path from 'path';
import cloudinary from '../../../config/cloudinary.js';
import { uploadToCloudinary } from '../../../utils/upload-to-cloudinary.js';
import type { CustomRequest } from '../../../types/express/auth.js';
import { ROLE } from '../../../utils/roles.js';
import pool from '../../../config/database-connection.js'; // <-- database connection

export const uploadResumeController = async (req: CustomRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    // Validate file extension
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ message: 'Only PNG, JPG, JPEG, or PDF files are allowed.' });
    }

    const cloudFolder = `resumes/${user.user_id}`;

    // ---- Delete old files in Cloudinary folder ----
    try {
      const resources = await cloudinary.api.resources({ type: 'upload', prefix: cloudFolder });
      if (resources.resources.length > 0) {
        const publicIds = resources.resources.map((r: { public_id: string }) => r.public_id);
        await cloudinary.api.delete_resources(publicIds);
      }
    } catch (err) {
      console.error('Error deleting old Cloudinary files:', err);
    }

    // ---- Upload new file to Cloudinary ----
    const cloudUrl = await uploadToCloudinary(
      path.resolve(file.path).replace(/\\/g, '/'),
      cloudFolder
    );

    // ---- Save Cloudinary URL to jobseeker table ----
    try {
      const connection = await pool.getConnection();
      await connection.query(
        `UPDATE jobseeker SET resume = ? WHERE jobseeker_id = ?`,
        [cloudUrl, user.user_id]
      );
      
      connection.release();
      
    } catch (dbErr) {
      console.error('Failed to save resume URL in DB:', dbErr);
      return res.status(500).json({ message: 'Failed to save resume in database' });
    }

    // ---- Remove old files in local resume folder except the new one ----
    const resumeFolder = path.join('./uploads', ROLE.JOBSEEKER, String(user.user_id), 'resume');
    if (fs.existsSync(resumeFolder)) {
      fs.readdirSync(resumeFolder).forEach(f => {
        const filePathToDelete = path.join(resumeFolder, f);
        if (filePathToDelete !== file.path) {
          try { fs.unlinkSync(filePathToDelete); } catch (err) { console.error(err); }
        }
      });
    }

    // ---- Remove uploaded file locally as well ----
    try { fs.unlinkSync(file.path); } catch {}

    return res.status(200).json({
      message: 'File uploaded successfully',
      url: cloudUrl,
    });

  } catch (err: any) {
    console.error('File upload error:', err);
    return res.status(500).json({ message: 'Failed to upload file', error: err.message });
  }
};
