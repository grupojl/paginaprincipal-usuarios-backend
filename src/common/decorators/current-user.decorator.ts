import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  uid:           string;
  email:         string;
  emailVerified: boolean;
  displayName?:  string;
  avatarUrl?:    string;
}

export const CurrentUser = createParamDecorator(
  (field: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const user: CurrentUserPayload = ctx.switchToHttp().getRequest().user;
    return field ? user?.[field] : user;
  },
);
