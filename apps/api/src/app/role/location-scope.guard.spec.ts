import { ExecutionContext } from '@nestjs/common';
import { LocationScopeGuard } from './location-scope.guard';

const contextFor = (user: any, location: string) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user, params: { location } }) }) } as unknown as ExecutionContext);

describe('LocationScopeGuard', () => {
  const guard = new LocationScopeGuard();
  const user = { roles: ['OPERATOR'], location: [{ code: 'SUB-NW-01', name: 'Partner C' }] };

  it('lets admins address any location', () => {
    expect(guard.canActivate(contextFor({ roles: ['ADMIN'], location: [] }, 'Partner A'))).toBe(true);
  });

  it('lets a user address their own location', () => {
    expect(guard.canActivate(contextFor(user, 'Partner C'))).toBe(true);
  });

  it('rejects another location', () => {
    expect(guard.canActivate(contextFor(user, 'Partner A'))).toBe(false);
  });

  it('rejects users with no locations', () => {
    expect(guard.canActivate(contextFor({ roles: ['OPERATOR'] }, 'Partner C'))).toBe(false);
  });
});
