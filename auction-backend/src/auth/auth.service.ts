import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseService } from '../common/database/database.service';
import type { CurrentUser } from '../common/types';

@Injectable()
export class AuthService {
  // Dedicated auth client — NEVER use DatabaseService.getClient() for auth operations.
  // signInWithPassword() and admin.createUser() mutate the calling client's session state.
  // Keeping them on a separate client prevents the service-role DB client from being corrupted.
  private readonly authClient: SupabaseClient;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {
    this.authClient = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: CurrentUser }> {
    const { data, error } = await this.authClient
      .auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const role = data.user.user_metadata?.['role'] as 'buyer' | 'vendor' | undefined;
    if (!role) {
      throw new UnauthorizedException('Account has no role assigned');
    }

    return {
      accessToken: data.session.access_token,
      user: { id: data.user.id, email: data.user.email ?? '', role },
    };
  }

  async register(
    email: string,
    password: string,
    companyName: string,
    contactName: string,
  ): Promise<{ message: string }> {
    // NOTE: Registration creates vendor accounts only.
    // Buyer accounts are created by an admin directly in Supabase.
    const { data, error } = await this.authClient
      .auth.admin.createUser({
        email,
        password,
        user_metadata: { role: 'vendor' },
        email_confirm: true,
      });

    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        throw new ConflictException('An account with this email already exists');
      }
      throw new UnauthorizedException(error.message);
    }

    if (data.user) {
      // Create the vendor profile row linked to the auth user
      await this.db.getClient().from('vendors').insert({
        user_id: data.user.id,
        email,
        company_name: companyName,
        contact_name: contactName,
        status: 'PENDING',
      });
    }

    return { message: 'Registration successful. Your account is pending approval.' };
  }
}
