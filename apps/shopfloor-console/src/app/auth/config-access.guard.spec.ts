import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AdminGuard, AreaGuard, LocationGuard } from './config-access.guard';

function routeWith(location: string): ActivatedRouteSnapshot {
  return { paramMap: { get: () => location } } as unknown as ActivatedRouteSnapshot;
}

describe('Config access guards', () => {
  let router: Router;

  function login(role: string, locations: string[], areas: string[] = ['config']) {
    localStorage.setItem('role', role);
    localStorage.setItem('locations', JSON.stringify(locations));
    localStorage.setItem('areas', JSON.stringify(areas));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RouterTestingModule] });
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  it('lets admins open admin pages and any location', () => {
    login('ADMIN', []);
    expect(TestBed.inject(AdminGuard).canActivate()).toBe(true);
    expect(TestBed.inject(LocationGuard).canActivate(routeWith('Partner A'))).toBe(true);
  });

  it('sends a non-admin away from admin pages to their own location', () => {
    login('OPERATOR', ['Partner C']);
    const result = TestBed.inject(AdminGuard).canActivate();
    expect(router.serializeUrl(result as any)).toBe('/config-categories/Partner%20C');
  });

  it('lets a non-admin open their own location only', () => {
    login('OPERATOR', ['Partner C']);
    const guard = TestBed.inject(LocationGuard);
    expect(guard.canActivate(routeWith('Partner C'))).toBe(true);
    expect(router.serializeUrl(guard.canActivate(routeWith('Partner A')) as any)).toBe('/config-categories/Partner%20C');
  });

  it('sends users without Config access home', () => {
    login('EXTUSER', ['Partner C']);
    expect(router.serializeUrl(TestBed.inject(AdminGuard).canActivate() as any)).toBe('/');
    expect(router.serializeUrl(TestBed.inject(LocationGuard).canActivate(routeWith('Partner C')) as any)).toBe('/');
  });

  it('sends an operator who holds no Config role away from the Config pages of their location', () => {
    login('OPERATOR', ['Partner C'], ['warehouse']);
    expect(router.serializeUrl(TestBed.inject(LocationGuard).canActivate(routeWith('Partner C')) as any)).toBe('/');
    expect(router.serializeUrl(TestBed.inject(AdminGuard).canActivate() as any)).toBe('/');
  });
});

describe('AreaGuard', () => {
  let router: Router;
  const routeFor = (area?: string) => ({ data: area ? { area } : {} } as unknown as ActivatedRouteSnapshot);
  const login = (role: string, areas?: string[]) => {
    localStorage.setItem('role', role);
    if (areas) {
      localStorage.setItem('areas', JSON.stringify(areas));
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [RouterTestingModule] });
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  it('lets a user in to an area they hold a role in', () => {
    login('OPERATOR', ['warehouse', 'config']);
    expect(TestBed.inject(AreaGuard).canActivate(routeFor('warehouse'))).toBe(true);
  });

  it('sends a user home from an area they do not hold, including one with no areas stored', () => {
    login('OPERATOR', ['warehouse']);
    expect(router.serializeUrl(TestBed.inject(AreaGuard).canActivate(routeFor('fat')) as any)).toBe('/');
    localStorage.removeItem('areas');
    expect(router.serializeUrl(TestBed.inject(AreaGuard).canActivate(routeFor('warehouse')) as any)).toBe('/');
  });

  it('lets an admin in everywhere', () => {
    login('ADMIN', []);
    expect(TestBed.inject(AreaGuard).canActivate(routeFor('fat'))).toBe(true);
  });

  it('lets anyone in to a route that names no area', () => {
    login('EXTUSER');
    expect(TestBed.inject(AreaGuard).canActivate(routeFor())).toBe(true);
  });

  it('reads areas from the token for a session that started before they were stored', () => {
    const payload = btoa(JSON.stringify({ areas: ['fat'], location: [] })).replace(/=+$/, '');
    localStorage.setItem('token', 'x.' + payload + '.y');
    login('EXTUSER');
    expect(TestBed.inject(AreaGuard).canActivate(routeFor('fat'))).toBe(true);
    expect(router.serializeUrl(TestBed.inject(AreaGuard).canActivate(routeFor('warehouse')) as any)).toBe('/');
  });

  it('ignores anything in the stored areas that is not a known area', () => {
    login('OPERATOR', ['warehouse', 'root', '']);
    expect(TestBed.inject(AreaGuard).canActivate(routeFor('warehouse'))).toBe(true);
    expect(router.serializeUrl(TestBed.inject(AreaGuard).canActivate(routeFor('root')) as any)).toBe('/');
  });
});
