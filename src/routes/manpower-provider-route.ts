import express from 'express';
import { registerUser } from '../controllers/userController/register/register-user-account.js';
import { verifyEmail } from '../controllers/userController/email-verification/email-verification.js';
import { uploadRequirement } from '../controllers/userController/upload-requirement/upload-user-requirement.js';
import { getUserProfile } from '../controllers/userController/user-profile/user-profile.js';
import { createJobPost } from '../controllers/userController/create-job-post/create-job-post.js';
import { conversations } from '../controllers/userController/messageController/conversation/conversations.js';
import { apply } from '../controllers/userController/apply/apply-job-post.js';
import { messageHistory } from '../controllers/userController/messageController/history/message-history.js';
import { replyMessage } from '../controllers/userController/messageController/reply/reply-message.js';
import { markAsSeen } from '../controllers/userController/messageController/seen/mark-as-seen.js';
import { updateJobPostStatus } from '../controllers/userController/job-post-status/update-jobpost-status.js';
import { softDeleteJobPost } from '../controllers/userController/delete-job-post/delete-job-post.js';
import { validateRegisterInput } from '../middleware/validate-register-input.js';
import { reportedUsers } from '../controllers/report-controller/reported-user/reported-user.js';
import { reportUser } from '../controllers/report-controller/report-user/report-user.js';
import { chatImageUpload, reportUpload } from '../middleware/upload-files.js';
import { uploadManpowerProviderFiles } from '../middleware/upload-files.js';
import { authenticate } from '../middleware/authenticate.js';
import { submitFeedback } from '../controllers/userController/submit-feedback/submit-feedback.js';
import { viewApplicants } from '../controllers/userController/view-applicant/view-applicants.js';
import { employerDashboard } from '../controllers/userController/employer-dashboard.js';
import { rejectApplication } from '../controllers/userController/reject-application/reject-application.js';
import { changeUserProfile } from '../middleware/upload-files.js';
import { changeProfile } from '../controllers/userController/change-profile/change-profile.js';
import { editJobPost } from '../controllers/job-post-controller/update-job-post/edit-job-post.js';
import { getNotified } from '../controllers/userController/notification/get-notified.js';
import { markNotificationSeen } from '../controllers/userController/notification/seen-notification.js';
import { createIndividualJobPost } from '../controllers/userController/create-job-post/create-individual-job-post.js';
import { createTeamJobPost } from '../controllers/userController/create-job-post/create-team-job-post.js';

const router = express.Router();

router.post('/register/manpower-provider', validateRegisterInput, registerUser);
router.get('/manpower-provider/verify', verifyEmail);
router.get('/manpower-provider/profile', authenticate, getUserProfile);
router.post(
  '/manpower-provider/upload-requirements',
  uploadManpowerProviderFiles,
  uploadRequirement
);
router.post('/manpower-provider/job-post', authenticate, createJobPost);
router.post('/manpower-provider/applications', authenticate, chatImageUpload, apply);
router.post('/manpower-provider/messages/send', authenticate, chatImageUpload, replyMessage);
router.get('/manpower-provider/conversations', authenticate, conversations);
router.get('/manpower-provider/message-history/:conversation_id', authenticate, messageHistory);
router.patch('/manpower-provider/mark-as-seen', authenticate, markAsSeen);
router.patch('/manpower-provider/:jobPostId/:status', authenticate, updateJobPostStatus);
router.delete('/manpower-provider/delete/jobpost/:jobPostId', authenticate, softDeleteJobPost);
router.post('/manpower-provider/report-user', authenticate, reportUpload, reportUser);
router.get('/manpower-provider/reported-users', authenticate, reportedUsers);
router.post('/manpower-provider/feedback', authenticate, submitFeedback);
router.get('/manpower-provider/applicants', authenticate, viewApplicants);
router.get('/manpower-provider/dashboard', authenticate, employerDashboard);
router.patch(
  '/manpower-provider/applications/:applicationId/reject',
  authenticate,
  rejectApplication
);
router.patch('/manpower-provider/change-profile', authenticate, changeUserProfile, changeProfile);
router.put('/manpower-provider/edit-job-post/:job_post_id', authenticate, editJobPost);
router.get('/manpower-provider/notification', authenticate, getNotified);
router.patch(
  '/manpower-provider/notification/:notification_id/seen',
  authenticate,
  markNotificationSeen
);
router.post('/manpower-provider/individual-job-post', authenticate, createIndividualJobPost);
router.post('/manpower-provider/team-job-post', authenticate, createTeamJobPost);

export default router;
