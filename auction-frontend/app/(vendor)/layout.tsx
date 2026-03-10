'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, signOut } from '@/lib/supabase';
import { vendorProfileApi } from '@/lib/api';
import { LayoutDashboard, Gavel, LogOut, Search, Sparkles } from 'lucide-react';
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
  const [email,       setEmail]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const initials = (displayName || email || 'Vendor')[0]?.toUpperCase() ?? 'V';

  return (
    <ToastProvider>
      <NotificationProvider>
    <div className="flex flex-col h-screen bg-bg-page overflow-hidden font-sans text-text-primary">

      {/* ── Top Navbar ─────────────────────────────────────────────────── */}
      <header className="h-[60px] shrink-0 bg-bg-page border-b border-border-subtle flex items-center justify-between px-6 gap-4 z-20">
        {/* Left: brand */}
        <div className="flex items-center gap-2.5 w-[200px] shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent">
            <Gavel size={15} className="text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-bold text-text-primary tracking-tight">Auction Engine</p>
            <p className="text-[10px] text-text-muted">Procurement Platform</p>
          </div>
        </div>

        {/* Center: search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                router.push(`/vendor/auctions?q=${encodeURIComponent(searchQuery.trim())}`);
                setSearchQuery('');
              }
            }}
            className="w-full bg-bg-elevated text-text-primary text-xs pl-8 pr-3 py-2 rounded-full border border-border-subtle placeholder:text-text-muted focus:outline-none focus:border-accent transition-all duration-150"
            placeholder="Search auctions… (Enter)"
          />
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <NotificationDropdown />

          <ThemeToggle />

          {/* User */}
          <div className="flex items-center gap-2.5 pl-2.5 ml-0.5 border-l border-border-subtle">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-[11px] font-bold text-white shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block">
              <p className="text-[12px] font-semibold text-text-primary leading-tight max-w-[120px] truncate">{displayName || 'Vendor'}</p>
              <p className="text-[10px] text-text-muted leading-tight">Vendor</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 rounded-full text-text-muted hover:text-danger hover:bg-danger/10 transition-colors duration-150"
              title="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body (sidebar + content) ────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="flex w-[200px] shrink-0 flex-col bg-bg-sidebar border-r border-border-subtle">
          {/* Portal label */}
          <div className="px-4 pt-5 pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.07em] text-text-muted bg-bg-tag px-2.5 py-1 rounded-full">
              Vendor Portal
            </span>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5 px-3 flex-1 pt-1">
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors duration-150',
                    active
                      ? 'bg-bg-card text-text-primary shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-border-subtle'
                      : 'text-text-secondary hover:bg-bg-card hover:text-text-primary',
                  )}
                >
                  <Icon size={15} className={active ? 'text-accent' : 'text-current'} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom status card */}
          <div className="px-3 pb-5 pt-2">
            <div className="rounded-2xl bg-bg-card border border-border-subtle p-3.5 flex flex-col gap-2 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-accent" />
                <p className="text-[11px] font-semibold text-text-primary">Live Bidding</p>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed">Accept invitations to join active auctions and place bids.</p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] text-success font-semibold">Active</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main — relative + overflow-hidden so glow stays fixed as content scrolls */}
        <main className="relative flex-1 overflow-hidden">
          {/* Purple ambient glow */}
          <div
            className="bg-purple-gradient-glow pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[80%]"
            aria-hidden="true"
          />
          {/* Scroll container */}
          <div className="relative z-10 h-full overflow-y-auto p-7">
            {children}
          </div>
        </main>
      </div>
    </div>
      </NotificationProvider>
    </ToastProvider>
  );
}
