import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './auth.types.js';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
