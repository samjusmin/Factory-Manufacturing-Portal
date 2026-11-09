import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AREAS_KEY } from './areas.decorator';
import { isAdminUser } from './location-scope.guard';

// The areas a signed-in user holds a role in, from the `areas` list in their token.
export function userAreas(user: any): string[] {
  return Array.isArray(user?.areas) ? user.areas : [];
}

// Lets a request through only if the user holds a role in one of the areas the route belongs to. Admins can open every
// area. Routes with no @Areas are not affected. This adds to the role checks (RolesGuard, LocationScopeGuard); it
// does not replace them. Put it after JwtAuthGuard, which is what puts the user on the request.
@Injectable()
export class AreasGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(AREAS_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    if (isAdminUser(user)) {
      return true;
    }
    const held = userAreas(user);
    return required.some(area => held.indexOf(area) > -1);
  }
}
