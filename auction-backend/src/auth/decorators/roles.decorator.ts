import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Returns CustomDecorator which is valid on both classes and methods
export const Roles = (...roles: Array<'buyer' | 'vendor'>) =>
  SetMetadata(ROLES_KEY, roles);
