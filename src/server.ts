import dotenv from 'dotenv';
import express from 'express';
import logger from './config/logger.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userSocketMap: Record<string, string> = {};
import initializeSocket from './config/socket-io.js';
const app = express();
const server = http.createServer(app);
const io = initializeSocket(server, userSocketMap);
app.set('io', io);
app.set('userSocketMap', userSocketMap);
import pool from './config/database-connection.js';
import './utils/cron-job-post.js';

// Your DB setup
import { createJobseekerTable } from './schema/jobseeker-schema.js';
import { createBusinessEmployerTable } from './schema/business-employer-schema.js';
import { createIndividualEmployerTable } from './schema/individual-employer-schema.js';
import { createManpowerProviderTable } from './schema/manpower-provider-schema.js';
import { createUsersTable } from './schema/users-schema.js';
import {
  createJobPostTable,
  createIndividualJobPostTable,
  createTeamJobPostTable,
} from './schema/job-post-schema.js';
import { createConversationsTable } from './schema/conversations-schema.js';
import { createMessagesTable } from './schema/messages-schema.js';
import { createJobApplicationsTable } from './schema/job-applications-schema.js';
import { createAdministrator } from './controllers/administrator-controller/create-administrator/create-administrator.js';
import { createReportsTable } from './schema/reports-schema.js';
import { createReportProofsTable } from './schema/report-proof-schema.js';
import { createFeedbackTable } from './schema/feedback-schema.js';
import { createNotificationTable } from './schema/notification-schema.js';
import { createHiresTable } from './schema/hires-schema.js';
// Routes
import jobseekerRoute from './routes/jobseeker-route.js';
import businessEmployerRoute from './routes/business-employer-route.js';
import individualEmployerRoute from './routes/individual-employer-route.js';
import manpowerProviderRoute from './routes/manpower-provider-route.js';
import authRoute from './routes/auth-route.js';
import verifyToken from './utils/verifyToken.js';
import administratorRoute from './routes/administrator-route.js';
import jobPostRoute from './routes/job-post-route.js';

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Routes
app.use('/', jobseekerRoute);
app.use('/', businessEmployerRoute);
app.use('/', individualEmployerRoute);
app.use('/', manpowerProviderRoute);
app.use('/', authRoute);
app.use('/', verifyToken);
app.use('/', administratorRoute);
app.use('/', jobPostRoute);

async function startServer() {
  const connection = await pool.getConnection();
  try {
    await createUsersTable(connection);
    await createJobseekerTable(connection);
    await createBusinessEmployerTable(connection);
    await createIndividualEmployerTable(connection);
    await createManpowerProviderTable(connection);
    await createJobPostTable(connection);
    (await createIndividualJobPostTable(connection),
      await createTeamJobPostTable(connection),
      await createConversationsTable(connection));
    await createMessagesTable(connection);
    await createJobApplicationsTable(connection);
    await createReportsTable(connection);
    await createReportProofsTable(connection);
    await createFeedbackTable(connection);
    await createNotificationTable(connection);
    await createAdministrator();
    await createHiresTable(connection);
    
    app.locals.db = connection;

    const port = process.env.API_PORT || 3001;

    server.listen(port, () => {
      logger.info(`Server running on port ${port}`);
    });
  } catch (error: any) {
    logger.error('Failed to start server', {
      name: error?.name || 'UnknownError',
      message: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace',
      cause: error?.cause || 'No cause',
      error,
    });
    process.exit(1);
  } finally {
    try {
      if (connection) connection.release();
    } catch (error) {
      logger.error('Failed to release DB connection', { error });
    }
  }
}

startServer();
export { app, io };
