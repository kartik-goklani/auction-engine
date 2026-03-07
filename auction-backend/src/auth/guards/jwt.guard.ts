import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import type { CurrentUser } from '../../common/types';

@Injectable()
export class JwtGuard implements CanActivate {
  // Dedicated auth-only client using the anon key.
  // NOTE: Never reuse DatabaseService's service-role client for auth.getUser() —
  // calling auth.getUser(jwt) on a shared client mutates its internal session state,
  // which strips the service role context from subsequent DB operations.
  private readonly authClient: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    this.authClient = createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_ANON_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: CurrentUser }>();

    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    const { data, error } = await this.authClient.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const role = data.user.user_metadata?.['role'] as 'buyer' | 'vendor' | undefined;
    if (!role) {
      throw new UnauthorizedException('Token is missing role in user_metadata');
    }

    request.user = {
      id: data.user.id,
      email: data.user.email ?? '',
      role,
    };

    return true;
  }
}
