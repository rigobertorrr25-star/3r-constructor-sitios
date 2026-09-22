import { SetMetadata } from '@nestjs/common';
import type { Role } from '../common/roles.js';

export const ROLES_KEY = 'roles';

/** Exige que el usuario tenga al menos uno de estos roles. Usar junto a JwtAuthGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
