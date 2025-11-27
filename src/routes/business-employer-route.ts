import express from "express";
import { registerUser } from "../controllers/userController/register/register-user-account.js";
import { verifyEmail } from "../controllers/userController/email-verification/email-verification.js";
import { uploadRequirement } from "../controllers/userController/upload-requirement/upload-user-requirement.js"
import { getUserProfile } from "../controllers/userController/user-profile/user-profile.js";
import { createJobPost } from "../controllers/userController/create-job-post/create-job-post.js";
import { conversations } from "../controllers/userController/messageController/conversation/conversations.js";
import { messageHistory } from "../controllers/userController/messageController/history/message-history.js"
import { replyMessage } from "../controllers/userController/messageController/reply/reply-message.js"
import { markAsSeen } from "../controllers/userController/messageController/seen/mark-as-seen.js";
import { updateJobPostStatus } from "../controllers/userController/job-post-status/update-jobpost-status.js";
import { contactAgency } from "../controllers/userController/contact-agent/contact-agency.js";
import { softDeleteJobPost } from "../controllers/userController/delete-job-post/delete-job-post.js";
import { uncontactedAgencies } from "../controllers/userController/uncontacted-agent/uncontacted-agency.js";
import { validateRegisterInput } from "../middleware/validate-register-input.js";
import { uploadBusinessEmployerFiles } from "../middleware/upload-files.js";
import { reportedUsers } from "../controllers/report-controller/reported-user/reported-user.js";
import { reportUser  } from "../controllers/report-controller/report-user/report-user.js";
import { chatImageUpload, reportUpload } from "../middleware/upload-files.js";
import { authenticate } from "../middleware/authenticate.js";
import { submitFeedback } from "../controllers/userController/submit-feedback/submit-feedback.js";
import { viewApplicants } from "../controllers/userController/view-applicant/view-applicants.js";
import { employerDashboard } from "../controllers/userController/employer-dashboard.js";
import { rejectApplication } from "../controllers/userController/reject-application/reject-application.js";
import { changeUserProfile } from "../middleware/upload-files.js";
import { changeProfile } from "../controllers/userController/change-profile/change-profile.js";
import { editJobPost } from "../controllers/job-post-controller/update-job-post/edit-job-post.js";
import { getNotified } from '../controllers/userController/notification/get-notified.js';
import { getAgencyPostsController } from '../controllers/job-post-controller/get-manpower-provider-posts/manpower-provider-posts.js';
import { apply } from "../controllers/userController/apply/apply-job-post.js";

const router = express.Router();

router.post("/register/business-employer", validateRegisterInput, registerUser);
router.get("/business-employer/verify", verifyEmail);
router.get("/business-employer/profile", authenticate, getUserProfile);
router.post("/business-employer/upload-requirements", authenticate, uploadBusinessEmployerFiles, uploadRequirement);
router.post("/business-employer/job-post", authenticate, createJobPost);
router.get("/business-employer/conversations", authenticate, conversations);
router.get("/business-employer/message-history/:conversation_id", authenticate, messageHistory);
router.post("/business-employer/messages/send", authenticate, chatImageUpload, replyMessage);
router.patch("/business-employer/mark-as-seen", authenticate, markAsSeen);
router.patch("/business-employer/:jobPostId/:status", authenticate, updateJobPostStatus);
router.delete("/business-employer/delete/jobpost/:jobPostId", authenticate, softDeleteJobPost);
router.post("/business-employer/message-agency", authenticate, chatImageUpload, contactAgency);
router.get('/business-employer/uncontacted-agencies', authenticate, uncontactedAgencies)
router.post("/business-employer/report-user", authenticate, reportUpload, reportUser);
router.get("/business-employer/reported-users", authenticate, reportedUsers);
router.post("/business-employer/feedback", authenticate, submitFeedback);
router.get("/business-employer/applicants", authenticate, viewApplicants);
router.get("/business-employer/dashboard", authenticate, employerDashboard);
router.patch("/business-employer/applications/:applicationId/reject", authenticate, rejectApplication);
router.patch("/business-employer/change-profile", authenticate, changeUserProfile, changeProfile);
router.put("/business-employer/edit-job-post/:job_post_id", authenticate, editJobPost);
router.get("/business-employer/notification", authenticate, getNotified);
router.get("/business-employer/manpower-posts", authenticate, getAgencyPostsController)
router.post("/business-employer/requests", authenticate, apply);

export default router;