import express from 'express';
import { registerUser } from '../controllers/userController/register/register-user-account.js';
import { verifyEmail } from '../controllers/userController/email-verification/email-verification.js';
import { uploadRequirement } from '../controllers/userController/upload-requirement/upload-user-requirement.js';
import { getUserProfile } from '../controllers/userController/user-profile/user-profile.js';
import { apply } from '../controllers/userController/apply/apply-job-post.js';
import { conversations } from '../controllers/userController/messageController/conversation/conversations.js';
import { messageHistory } from '../controllers/userController/messageController/history/message-history.js';
import { replyMessage } from '../controllers/userController/messageController/reply/reply-message.js';
import { markAsSeen } from '../controllers/userController/messageController/seen/mark-as-seen.js';
import { contactAgency } from '../controllers/../controllers/userController/contact-agent/contact-agency.js';
import { uncontactedAgencies } from '../controllers/userController/uncontacted-agent/uncontacted-agency.js';
import { validateRegisterInput } from '../middleware/validate-register-input.js';
import { reportedUsers } from '../controllers/report-controller/reported-user/reported-user.js';
import { reportUser } from '../controllers/report-controller/report-user/report-user.js';
import { chatImageUpload, reportUpload } from '../middleware/upload-files.js';
import { uploadJobseekerFiles } from '../middleware/upload-files.js';
import { authenticate } from '../middleware/authenticate.js';
import { submitFeedback } from '../controllers/userController/submit-feedback/submit-feedback.js';
import { changeUserProfile } from '../middleware/upload-files.js';
import { changeProfile } from '../controllers/userController/change-profile/change-profile.js';
import { getNotified } from '../controllers/userController/notification/get-notified.js';
import { markNotificationSeen } from '../controllers/userController/notification/seen-notification.js';
import { acceptOffer } from '../controllers/userController/accept-decline-offer/accept-offer.js';

const router = express.Router();

router.post('/register/jobseeker', validateRegisterInput, registerUser);
router.get('/jobseeker/verify', verifyEmail);
router.get('/jobseeker/profile', authenticate, getUserProfile);
router.post(
  '/jobseeker/upload-requirements',
  authenticate,
  uploadJobseekerFiles,
  uploadRequirement
);
router.post('/jobseeker/applications', authenticate, chatImageUpload, apply);
router.get('/jobseeker/conversations', authenticate, conversations);
router.get('/jobseeker/message-history/:conversation_id', authenticate, messageHistory);
router.post('/jobseeker/messages/send', authenticate, chatImageUpload, replyMessage);
router.patch('/jobseeker/mark-as-seen', authenticate, markAsSeen);
router.post('/jobseeker/message-agency', authenticate, chatImageUpload, contactAgency);
router.get('/jobseeker/uncontacted-agencies', authenticate, uncontactedAgencies);
router.post('/jobseeker/report-user', authenticate, reportUpload, reportUser);
router.get('/jobseeker/reported-users', authenticate, reportedUsers);
router.post('/jobseeker/feedback', authenticate, submitFeedback);
router.patch('/jobseeker/change-profile', authenticate, changeUserProfile, changeProfile);
router.get('/jobseeker/notification', authenticate, getNotified);
router.patch('/jobseeker/notification/:notification_id/seen', authenticate, markNotificationSeen);
router.patch('/jobseeker/accept-offer', authenticate, acceptOffer);

export default router;
