import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Role } from './role.enum';

// Names of the locations in the user's JWT payload (`location: {code, name}[]`).
export function userLocationNames(user: any): string[] {
  return Array.isArray(user?.location) ? user.location.map(l => l?.name).filter(Boolean) : [];
}

export function isAdminUser(user: any): boolean {
  // Same comparison as RolesGuard: stored roles are upper case, the enum is lower case.
  return !!user?.roles?.includes(Role.ADMIN.toUpperCase());
}

// Restricts routes carrying a `:location` param to the caller's own locations.
// Admins can address any location. Use after JwtAuthGuard.
@Injectable()
export class LocationScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user, params } = request;
    if (isAdminUser(user)) {
      return true;
    }
    return userLocationNames(user).includes(params.location);
  }
}
