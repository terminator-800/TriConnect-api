import express from "express";
import { approvedJobPosts } from "../controllers/job-post-controller/approved-job-posts/approved-job-post.js";
import { unappliedJobPosts } from "../controllers/job-post-controller/unapplied-job-post/unnapplied-job-post.js";
import { jobPostsByUser } from "../controllers/job-post-controller/job-post-by-user/job-post-by-user.js";
import { authenticate } from "../middleware/authenticate.js";
const router = express.Router();

router.get("/approvedJobPosts", authenticate, approvedJobPosts)
router.get("/unappliedJobPosts", authenticate, unappliedJobPosts)
router.get("/jobPosts", authenticate, jobPostsByUser)

export default router;