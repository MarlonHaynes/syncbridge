import dotenv from "dotenv";
import path from "path";

// Always resolve the monorepo root .env regardless of the process's cwd
// (npm workspace scripts run with cwd = server/, not the repo root).
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function int(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  port: int("PORT", 4000),
  nodeEnv: required("NODE_ENV", "development"),

  useMockSalesforce: bool("USE_MOCK_SALESFORCE", true),
  useMockNexcore: bool("USE_MOCK_NEXCORE", true),

  salesforce: {
    instanceUrl: required("SF_INSTANCE_URL", "https://placeholder.my.salesforce.com"),
    clientId: required("SF_CLIENT_ID", "placeholder_client_id"),
    clientSecret: required("SF_CLIENT_SECRET", "placeholder_client_secret"),
    username: required("SF_USERNAME", "placeholder@example.com"),
    password: required("SF_PASSWORD", "placeholder_password"),
    apiVersion: required("SF_API_VERSION", "v60.0"),
  },

  nexcore: {
    apiUrl: required("NEXCORE_API_URL", "https://placeholder.nexcore.app"),
    apiKey: required("NEXCORE_API_KEY", "placeholder_nexcore_key"),
  },

  databaseUrl: required("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/syncbridge"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),

  queue: {
    maxAttempts: int("QUEUE_MAX_ATTEMPTS", 5),
    backoffDelayMs: int("QUEUE_BACKOFF_DELAY_MS", 2000),
  },

  scheduler: {
    sfPollIntervalMs: int("SF_POLL_INTERVAL_MS", 30000),
  },
};
