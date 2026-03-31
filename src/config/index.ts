/**
 * Configuration Module
 *
 * Validates and exposes environment variables using Zod.
 * Runtime-critical requirements are enforced at server startup so tests can import modules safely.
 */

import { z } from 'zod';

const configSchema = z.object({
  // Optional at import time; required when starting the server.
  META_SYSTEM_USER_TOKEN: z.string().optional().default(''),

  // Optional with defaults
  META_API_VERSION: z.string().default('v22.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CACHE_TTL_SECONDS: z.coerce.number().positive().default(300),
  MAX_RETRIES: z.coerce.number().positive().default(3),
  RETRY_BASE_DELAY_MS: z.coerce.number().positive().default(1000),
});

export const config = configSchema.parse(process.env);

export type Config = z.infer<typeof configSchema>;
