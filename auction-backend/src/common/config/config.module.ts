import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { z } from 'zod';

/**
 * Application configuration module.
 * Infrastructure layer: validates environment variables at startup.
 */
const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_DB_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  LANGCHAIN_TRACING_V2: z.enum(['true', 'false']).default('false'),
  LANGCHAIN_API_KEY: z.string().min(1),
  LANGCHAIN_PROJECT: z.string().min(1),
  SERPER_API_KEY: z.string().min(1),
  DEFAULT_MARKET: z.string().min(1).default('India'),
  SERPER_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  SERPER_MAX_RESULTS: z.coerce.number().int().positive().max(10).default(5),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URLS: z.string().min(1).default('http://localhost:3000'),
});

function validate(config: Record<string, unknown>): Record<string, unknown> {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const missing = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`❌ Invalid environment configuration:\n${missing}`);
  }
  return result.data as Record<string, unknown>;
}

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
  ],
})
export class ConfigModule {}
