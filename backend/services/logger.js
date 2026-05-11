import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS[config.logging.level] || LOG_LEVELS.info;
    this.logDir = path.dirname(config.logging.filePath);
    
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  format(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta,
      service: "ChangeAIPay"
    };
    
    if (meta.error && meta.error.stack) {
      logEntry.stack = meta.error.stack;
    }
    
    return JSON.stringify(logEntry);
  }

  write(level, message, meta = {}) {
    if (LOG_LEVELS[level] > this.level) return;
    
    const formatted = this.format(level, message, meta);
    
    console.log(formatted);
    
    const date = new Date().toISOString().split("T")[0];
    const logFile = path.join(this.logDir, `app-${date}.log`);
    
    fs.appendFileSync(logFile, formatted + "\n");
  }

  error(message, meta = {}) {
    this.write("error", message, meta);
  }

  warn(message, meta = {}) {
    this.write("warn", message, meta);
  }

  info(message, meta = {}) {
    this.write("info", message, meta);
  }

  http(message, meta = {}) {
    this.write("http", message, meta);
  }

  debug(message, meta = {}) {
    this.write("debug", message, meta);
  }

  logRequest(req, res, duration) {
    this.http("HTTP Request", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("user-agent")
    });
  }

  logTransaction(type, data) {
    this.info(`Transaction: ${type}`, {
      transactionId: data.id,
      userId: data.userId,
      amount: data.amount,
      hash: data.hash,
      status: data.status
    });
  }

  logSecurity(event, data) {
    this.warn(`Security: ${event}`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  logPerformance(operation, duration, metadata = {}) {
    this.info(`Performance: ${operation}`, {
      duration: `${duration}ms`,
      ...metadata
    });
  }
}

const logger = new Logger();

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  
  next();
};

export const errorLogger = (err, req, res, next) => {
  logger.error("Unhandled Error", {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    body: req.body
  });
  next(err);
};

export default logger;