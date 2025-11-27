import fs from "fs";
import path from "path";
import winston from "winston";
import dotenv from "dotenv";
dotenv.config();
import { Logtail } from "@logtail/node";
import { LogtailTransport } from "@logtail/winston";
import { format as formatDate } from "date-fns";

const customTimestamp = winston.format.timestamp({
  format: () => formatDate(new Date(), "MMMM dd, yyyy 'at' hh:mm:ss a"),
});

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const SOURCE_TOKEN = process.env.SOURCE_TOKEN!;
const BETTERSTACK_URL = process.env.BETTERSTACK_URL!;

if (!SOURCE_TOKEN) throw new Error("Missing SOURCE_TOKEN for Better Stack logtail");
if (!BETTERSTACK_URL) throw new Error("Missing BETTERSTACK_URL for Better Stack logtail");

const logtail = new Logtail(SOURCE_TOKEN, {
  endpoint: BETTERSTACK_URL,
});

const transports: winston.transport[] = [];

if (process.env.NODE_ENV === "production") {
  // Cloud logging only
  transports.push(new LogtailTransport(logtail));
} else {
  // Local logging only
  transports.push(
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logDir, "combined.log") })
  );
}

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    customTimestamp,
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === "production"
      ? winston.format.json()
      : winston.format.printf(({ level, message, timestamp, stack }) => {
        return stack
          ? `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}`
          : `${timestamp} [${level.toUpperCase()}] ${message}`;
      })
  ),
  transports,
});

// Exceptions & rejections
if (process.env.NODE_ENV === "production") {
  logger.exceptions.handle(new LogtailTransport(logtail));
  logger.rejections.handle(new LogtailTransport(logtail));
} else {
  logger.exceptions.handle(
    new winston.transports.File({ filename: path.join(logDir, "exceptions-dev.log") })
  );
  logger.rejections.handle(
    new winston.transports.File({ filename: path.join(logDir, "rejections-dev.log") })
  );
}

// Ensure unhandled rejections are passed to Winston
process.on("unhandledRejection", (reason: unknown) => {
  throw reason instanceof Error ? reason : new Error(String(reason));
});

export default logger;
