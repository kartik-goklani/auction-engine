/**
 * Single source of truth for all environment variables.
 * No component or lib file may access process.env directly.
 *
 * IMPORTANT: NEXT_PUBLIC_ variables must be accessed via static member
 * expressions (process.env.NEXT_PUBLIC_FOO), not computed keys
 * (process.env[key]), because Turbopack/Webpack only inlines the former.
 */

function assertDefined(key: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  supabaseUrl:     assertDefined('NEXT_PUBLIC_SUPABASE_URL',     process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: assertDefined('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  apiUrl:          assertDefined('NEXT_PUBLIC_API_URL',           process.env.NEXT_PUBLIC_API_URL),
  wsUrl:           assertDefined('NEXT_PUBLIC_WS_URL',            process.env.NEXT_PUBLIC_WS_URL),
} as const;
