'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Gavel } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Sign in via Supabase client so the session is stored in the browser.
      // This is the only correct way to establish a session that getAccessToken()
      // can read — calling the backend login endpoint alone does NOT set the session.
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError || !data.session) {
        throw new Error(authError?.message ?? 'Invalid credentials.');
      }
      const role = (data.user.user_metadata?.role as string | undefined) ?? '';
      router.replace(role === 'buyer' ? '/buyer/dashboard' : '/vendor/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-page px-4">
      {/* Subtle background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#18181b 1px, transparent 1px), linear-gradient(to right, #18181b 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
            <Gavel size={26} className="text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Auction Engine</h1>
            <p className="mt-1 text-sm text-text-muted">Agentic Procurement Platform</p>
          </div>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-2xl bg-bg-card border border-border-subtle p-7 shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
        >
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary">Sign in to your account</h2>
            <p className="mt-0.5 text-xs text-text-muted">Enter your credentials to continue</p>
          </div>

          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            error={error}
          />

          <Button type="submit" variant="primary" loading={loading} className="w-full mt-1">
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-[11px] text-text-muted">
          Contact your administrator to get access.
        </p>
      </div>
    </div>
  );
}
