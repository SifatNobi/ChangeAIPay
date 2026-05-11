import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, `../.env.${process.env.NODE_ENV || "development"}`)
});

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  
  mongodb: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017/changeaipay",
    options: {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2
    }
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
    expiry: process.env.JWT_EXPIRY || "7d",
    algorithm: "HS256"
  },
  
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY
  },
  
  rpc: {
    nodes: (process.env.RPC_NODES || "https://rpc.nano.node,https://nano.mynano.ninja")
      .split(",")
      .map(n => n.trim())
      .filter(Boolean),
    timeout: parseInt(process.env.RPC_TIMEOUT || "10000", 10),
    retryAttempts: parseInt(process.env.RPC_RETRY_ATTEMPTS || "3", 10)
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10)
  },
  
  cors: {
    origins: (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
      .split(",")
      .map(o => o.trim())
      .filter(Boolean)
  },
  
  websocket: {
    enabled: process.env.WS_ENABLED !== "false",
    port: parseInt(process.env.WS_PORT || "3001", 10),
    path: "/ws"
  },
  
  ai: {
    enabled: process.env.AI_SERVICE_ENABLED === "true",
    model: process.env.AI_MODEL || "claude-3-sonnet",
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || "1000", 10)
  },
  
  logging: {
    level: process.env.LOG_LEVEL || "info",
    filePath: process.env.LOG_FILE_PATH || "./logs/app.log",
    maxFiles: 5,
    maxSize: "10m"
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12", 10),
    sessionSecret: process.env.SESSION_SECRET || "dev-session-secret",
    csrfEnabled: process.env.CSRF_ENABLED !== "false"
  },
  
  pagination: {
    defaultLimit: 50,
    maxLimit: 200
  }
};

export function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export default config;