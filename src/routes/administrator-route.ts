import express from 'express';
import { createAdministrator } from '../controllers/administrator-controller/create-administrator/create-administrator.js';
import { submittedUsers } from '../controllers/administrator-controller/submitted-users.js';
import { pendingJobPosts } from '../controllers/administrator-controller/pending-job-post/pending-job-posts.js';
import { verifyUser } from '../controllers/administrator-controller/verify-user/verify-user.js';
import { rejectUser } from '../controllers/administrator-controller/reject-user/reject-user.js';
import { rejectAnyJobPost } from '../controllers/administrator-controller/reject-job-post/reject-job-post.js';
import { approveAnyJobPost } from '../controllers/administrator-controller/approve-job-post/approve-job-post.js';
import { verifiedUsers } from '../controllers/administrator-controller/verified-users.js';
import { verifiedJobPosts } from '../controllers/administrator-controller/verified-job-post/verified-job-posts.js';
import { reportedUsers } from '../controllers/administrator-controller/reported-users.js';
import { restrictUser } from '../controllers/administrator-controller/retrict-user/restrict-user.js';
import { dismissReport } from '../controllers/administrator-controller/dismiss-report/dismiss-report.js';
import { usersFeedbacks } from '../controllers/administrator-controller/users-feedbacks.js';
import { getUserProfile } from '../controllers/userController/user-profile/user-profile.js';
import { authenticate } from '../middleware/authenticate.js';
import { getDashboardSummary } from '../controllers/administrator-controller/get-chart-data/get-dashboard-summary.js';
import { getNotified } from '../controllers/userController/notification/get-notified.js';

const router = express.Router();

router.post('/administrator/', createAdministrator);
router.get('/administrator/profile', authenticate, getUserProfile);
router.get('/administrator/submittedUsers', authenticate, submittedUsers);
router.get('/administrator/pendingJobPosts', authenticate, pendingJobPosts);
router.put('/administrator/verify/user/:user_id', authenticate, verifyUser);
router.put('/administrator/reject/user/:user_id', authenticate, rejectUser);
router.put('/administrator/reject/jobpost', authenticate, rejectAnyJobPost);
router.put('/administrator/approve/jobpost', authenticate, approveAnyJobPost);
router.get('/administrator/verifiedUsers', authenticate, verifiedUsers);
router.get('/administrator/verifiedJobPosts', authenticate, verifiedJobPosts);
router.get('/administrator/all-reported-users', authenticate, reportedUsers);
router.post('/administrator/restrict-user', authenticate, restrictUser);
router.post('/administrator/dismiss-report', authenticate, dismissReport);
router.get('/administrator/user-feedbacks', authenticate, usersFeedbacks);
router.get('/administrator/chart-data', authenticate, getDashboardSummary);
router.get('/administrator/notification', authenticate, getNotified);

export default router;
