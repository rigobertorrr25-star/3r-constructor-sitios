import type { Role } from '../common/roles.js';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  roles: Role[];
}

export interface AuthUser {
  id: string;
  sessionId: string;
  roles: Role[];
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}
