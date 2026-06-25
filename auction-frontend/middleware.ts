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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // response must be mutable so setAll can update it when tokens are rotated
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // Write refreshed tokens back into the request (so subsequent reads
        // within this middleware execution see the new values) and into the
        // response (so the browser stores the new tokens).
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() validates the JWT with the Supabase server on every call and
  // correctly handles token rotation. getSession() only reads from cookies and
  // will not detect an expired session until the browser tries to use it.
  const { data: { user } } = await supabase.auth.getUser();

  const redirect = (path: string): NextResponse => {
    const redirectResponse = NextResponse.redirect(new URL(path, request.url));
    // Copy any rotated auth cookies to the redirect response so the browser
    // stores them. Without this, the old refresh token is reused on the next
    // request, causing "Invalid Refresh Token: Already Used".
    response.cookies.getAll().forEach(({ name, value, ...rest }) => {
      redirectResponse.cookies.set(name, value, rest);
    });
    return redirectResponse;
  };

  if (!user) {
    return redirect('/login');
  }

  const role = (user.user_metadata?.role as string | undefined) ?? '';

  if (pathname.startsWith('/buyer') && role !== 'buyer') {
    return redirect('/vendor/dashboard');
  }

  if (pathname.startsWith('/vendor') && role !== 'vendor') {
    return redirect('/buyer/dashboard');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
