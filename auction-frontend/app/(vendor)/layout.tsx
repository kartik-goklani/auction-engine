'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, signOut } from '@/lib/supabase';
import { vendorProfileApi } from '@/lib/api';
import { LayoutDashboard, Gavel, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationDropdown } from '@/components/ui/NotificationDropdown';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import { ToastProvider } from '@/components/ui/NotificationToast';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/vendor/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/vendor/auctions',  label: 'Auctions',  Icon: Gavel           },
];

export default function VendorLayout({ children }: { children: ReactNode }) {
  const pathname      = usePathname();
  const router        = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email,       setEmail]       = useState('');

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      supabase.auth.getUser(),
      vendorProfileApi.get().catch(() => null),
    ]).then(([{ data }, profile]) => {
      if (cancelled) return;

      const fallbackEmail = data.user?.email ?? '';
      const resolvedName =
        profile?.contact_name?.trim() ||
        profile?.company_name?.trim() ||
        fallbackEmail.split('@')[0] ||
        'Vendor';

      setEmail(fallbackEmail);
      setDisplayName(resolvedName);
    });

    return () => { cancelled = true; };
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const initials = (displayName || email || 'V')[0]?.toUpperCase() ?? 'V';

  return (
    <ToastProvider>
      <NotificationProvider>
        <div className="flex flex-col h-screen bg-bg-page overflow-hidden font-sans text-text-primary">

          {/* ── Top Navbar ─────────────────────────────────────────────────── */}
          <header className="h-12 shrink-0 bg-bg-sidebar border-b border-border-subtle flex items-center justify-between px-4 gap-4 z-20">

            {/* Left: brand wordmark */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="flex h-6 w-6 items-center justify-center bg-accent text-[#0A0A0A]">
                <Gavel size={11} strokeWidth={2.5} />
              </div>
              <div className="leading-tight">
                <p className="text-[11px] font-semibold text-text-primary tracking-wide uppercase">
                  Auction Engine
                </p>
                <p className="text-[8px] text-text-muted tracking-widest uppercase">
                  Vendor Portal
                </p>
              </div>
            </div>

            {/* Right: actions + identity */}
            <div className="flex items-center gap-1.5">
              <NotificationDropdown />
              <ThemeToggle />

              <div className="flex items-center gap-2 pl-3 ml-1 border-l border-border-subtle">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-bg-elevated border border-border-default text-[10px] font-bold text-accent">
                  {initials}
                </div>
                <div className="hidden sm:block">
                  <p className="text-[11px] font-semibold text-text-primary leading-tight max-w-[120px] truncate">
                    {displayName || 'Vendor'}
                  </p>
                  <p className="text-[8px] text-text-muted leading-tight uppercase tracking-wider">
                    {email ? email.split('@')[1] : 'vendor'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-1.5 text-text-muted hover:text-danger transition-colors duration-150"
                  title="Sign out"
                >
                  <LogOut size={12} />
                </button>
              </div>
            </div>
          </header>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden">

            {/* Sidebar — icon + label, no wasted space */}
            <aside className="flex w-48 shrink-0 flex-col bg-bg-sidebar border-r border-border-subtle">
              <div className="px-4 pt-5 pb-3">
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Navigation
                </span>
              </div>

              <nav className="flex flex-col gap-px px-2 flex-1">
                {NAV_ITEMS.map(({ href, label, Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium transition-colors duration-150 rounded-[3px] border-l-2',
                        active
                          ? 'border-l-accent text-text-primary bg-bg-elevated'
                          : 'border-l-transparent text-text-muted hover:text-text-secondary hover:bg-bg-elevated/50',
                      )}
                    >
                      <Icon size={13} className="shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </nav>

              {/* Bottom: live indicator — minimal, just a dot + label */}
              <div className="px-4 pb-5 pt-2">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-amber-pulse" />
                  <span className="text-[9px] text-text-muted uppercase tracking-wider font-medium">
                    System Live
                  </span>
                </div>
              </div>
            </aside>

            <main className="flex-1 overflow-hidden bg-bg-page">
              <div className="h-full overflow-y-auto p-6">
                {children}
              </div>
            </main>
          </div>
        </div>
      </NotificationProvider>
    </ToastProvider>
  );
}
