'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { FormInput } from '@/components/ui/FormInput';
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
      {/* Dot-grid background — very faint */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--text-muted) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="w-full max-w-sm relative">
        {/* Wordmark */}
        <div className="mb-10 flex flex-col items-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center bg-accent text-[#0A0A0A]">
            <Gavel size={22} strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">Auction Engine</h1>
            <p className="mt-1 text-[11px] text-text-muted tracking-widest uppercase">Procurement Platform</p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 bg-bg-card border border-border-subtle p-6 rounded-[4px]"
        >
          {/* Amber left-rule — the exchange signature on the login card */}
          <div className="-ml-6 -mt-6 mb-0 h-[2px] w-12 bg-accent" />

          <div className="mt-1">
            <h2 className="text-[13px] font-semibold text-text-primary tracking-tight">Sign in</h2>
            <p className="mt-0.5 text-[11px] text-text-muted">Enter your credentials to continue.</p>
          </div>

          <FormInput
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
          <FormInput
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            error={error}
          />

          <Button type="submit" variant="default" loading={loading} className="w-full mt-1">
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-[10px] text-text-muted uppercase tracking-widest">
          Contact your administrator to request access.
        </p>
      </div>
    </div>
  );
}
