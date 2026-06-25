'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, signOut } from '@/lib/supabase';
import {
  LayoutDashboard,
  Gavel,
  Building2,
  LogOut,
  Search,
  Plus,
  Sparkles,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationDropdown } from '@/components/ui/NotificationDropdown';
import { NotificationProvider } from '@/components/ui/NotificationProvider';
import { ToastProvider } from '@/components/ui/NotificationToast';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/buyer/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/buyer/auctions',  label: 'Auctions',  Icon: Gavel           },
  { href: '/buyer/vendors',   label: 'Vendors',   Icon: Building2       },
];

export default function BuyerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [email,       setEmail]       = useState('');
  const [displayName, setDisplayName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      const fallbackEmail = user?.email ?? '';
      const metadata = user?.user_metadata as Record<string, unknown> | undefined;
      const nameFromMetadata = typeof metadata?.full_name === 'string'
        ? metadata.full_name
        : typeof metadata?.name === 'string'
          ? metadata.name
          : '';

      setEmail(fallbackEmail);
      setDisplayName(nameFromMetadata || fallbackEmail.split('@')[0] || 'Buyer');
    });
  }, []);

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const initials = (displayName || email || 'Buyer')[0]?.toUpperCase() ?? 'B';

  return (
    <ToastProvider>
      <NotificationProvider>
        <div className="flex flex-col h-screen bg-bg-page overflow-hidden font-sans text-text-primary">

          {/* ── Top Navbar ──────────────────────────────────────────────────── */}
          <header className="h-14 shrink-0 bg-bg-sidebar border-b border-border-subtle flex items-center justify-between px-6 gap-4 z-20">
            {/* Left: brand */}
            <div className="flex items-center gap-3 w-[192px] shrink-0">
              <div className="flex h-7 w-7 items-center justify-center bg-accent text-[#0A0A0A]">
                <Gavel size={13} strokeWidth={2.5} />
              </div>
              <div className="leading-tight">
                <p className="text-[12px] font-semibold text-text-primary tracking-wide uppercase">Auction Engine</p>
                <p className="text-[9px] text-text-muted tracking-widest uppercase">Procurement</p>
              </div>
            </div>

            {/* Center: search */}
            <div className="relative flex-1 max-w-xs">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    router.push(`/buyer/auctions?q=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchQuery('');
                  }
                }}
                className="w-full bg-bg-card text-text-primary text-xs pl-8 pr-3 py-2 rounded-[4px] border border-border-subtle placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors duration-150"
                placeholder="Search auctions…"
              />
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/buyer/auctions/new"
                className="inline-flex items-center gap-1.5 bg-accent text-[#0A0A0A] text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-accent-hover transition-colors duration-150"
              >
                <Plus size={12} strokeWidth={2.5} />
                New Auction
              </Link>

              <NotificationDropdown />
              <ThemeToggle />

              {/* User */}
              <div className="flex items-center gap-2 pl-3 ml-1 border-l border-border-subtle">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-bg-elevated border border-border-default text-[10px] font-bold text-accent">
                  {initials}
                </div>
                <div className="hidden sm:block">
                  <p className="text-[11px] font-semibold text-text-primary leading-tight max-w-[100px] truncate">{displayName || 'Buyer'}</p>
                  <p className="text-[9px] text-text-muted leading-tight uppercase tracking-wider">Buyer</p>
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

          {/* ── Body (sidebar + content) ────────────────────────────────────── */}
          <div className="flex flex-1 overflow-hidden">

            {/* Sidebar */}
            <aside className="flex w-[192px] shrink-0 flex-col bg-bg-sidebar border-r border-border-subtle">
              {/* Portal label */}
              <div className="px-4 pt-5 pb-4">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Buyer Portal
                </span>
              </div>

              {/* Nav */}
              <nav className="flex flex-col gap-px px-2 flex-1">
                {NAV_ITEMS.map(({ href, label, Icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2.5 text-[12px] font-medium transition-colors duration-150 rounded-[3px]',
                        'border-l-2',
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

              {/* Bottom AI status card */}
              <div className="px-3 pb-5 pt-2">
                <div className="border border-border-subtle bg-bg-card p-3 rounded-[4px]">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={11} className="text-accent" />
                    <p className="text-[10px] font-semibold text-text-primary uppercase tracking-wider">AI Active</p>
                  </div>
                  <p className="text-[10px] text-text-muted leading-relaxed mb-2">Price intelligence running on all live auctions.</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-amber-pulse" />
                    <span className="text-[9px] text-success font-semibold uppercase tracking-wider">Live</span>
                  </div>
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
