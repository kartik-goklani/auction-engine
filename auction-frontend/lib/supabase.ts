/**
 * Supabase client — auth operations ONLY.
 * Never use this client to fetch application data.
 * All application data comes from lib/api.ts (auction-backend).
 *
 * Uses createBrowserClient from @supabase/ssr so the session is stored in
 * cookies (not localStorage). This is required for the Next.js middleware to
 * read the session server-side and apply role-based redirects.
 */
import { createBrowserClient } from '@supabase/ssr';
import { config } from './config';

export const supabase = createBrowserClient(config.supabaseUrl, config.supabaseAnonKey);

/** Get the currently stored access token, or null if not authenticated. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Sign the user out and clear the local session. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
