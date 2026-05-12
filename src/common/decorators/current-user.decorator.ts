import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Pega dados do usuário autenticado a partir de req.user.
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!data) {
      return user;
    }

    return user?.[data];
  },
);