/**
 * Auth guard and role-based redirect for all protected routes.
 * Runs on every request before the page renders.
 *
 * Rules:
 *   - Unauthenticated → /login
 *   - buyer role → (buyer)/* only; any (vendor)/* attempt → /buyer/dashboard
 *   - vendor role → (vendor)/* only; any (buyer)/* attempt → /vendor/dashboard
 */

import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Skip middleware for auth pages and static assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const role = (session.user.user_metadata?.role as string | undefined) ?? '';

  if (pathname.startsWith('/buyer') && role !== 'buyer') {
    return NextResponse.redirect(new URL('/vendor/dashboard', request.url));
  }

  if (pathname.startsWith('/vendor') && role !== 'vendor') {
    return NextResponse.redirect(new URL('/buyer/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
