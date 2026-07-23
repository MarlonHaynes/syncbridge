import IORedis from "ioredis";
import { env } from "../config/env";

/**
 * BullMQ requires maxRetriesPerRequest: null on the underlying ioredis
 * connection so it can manage its own blocking-connection retry behavior.
 */
export const connection = new IORedis(env.redisUrl, {
  maxRetriesPerRequest: null,
});
