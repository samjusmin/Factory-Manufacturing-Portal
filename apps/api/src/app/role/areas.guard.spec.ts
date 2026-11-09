import { Reflector } from '@nestjs/core';
import { Areas } from './areas.decorator';
import { AreasGuard, userAreas } from './areas.guard';

// A route (or controller) carrying @Areas, and a request from the given user.
function run(areas: string[] | null, user: any) {
  class Controller {
    handler() { return true; }
  }
  if (areas) {
    Areas(...(areas as any))(Controller);
  }
  const context: any = {
    getHandler: () => Controller.prototype.handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  };
  return new AreasGuard(new Reflector()).canActivate(context);
}

describe('AreasGuard', () => {
  const operator = (areas?: string[]) => ({ roles: ['OPERATOR'], areas });

  it('lets in a user who holds a role in the area', () => {
    expect(run(['warehouse'], operator(['warehouse', 'config']))).toBe(true);
    expect(run(['config'], operator(['warehouse', 'config']))).toBe(true);
  });

  it('refuses a user who does not hold it, including one with no areas at all', () => {
    expect(run(['fat'], operator(['warehouse', 'config']))).toBe(false);
    expect(run(['fat'], operator([]))).toBe(false);
    expect(run(['fat'], operator(undefined))).toBe(false);
    expect(run(['fat'], { roles: ['OPERATOR'] })).toBe(false);
    expect(run(['fat'], undefined)).toBe(false);
  });

  it('lets an admin into every area, whatever their areas say', () => {
    expect(run(['warehouse'], { roles: ['ADMIN'], areas: [] })).toBe(true);
    expect(run(['fat'], { roles: ['ADMIN'] })).toBe(true);
  });

  it('does not treat a user listing an area as admin, or the reverse of the role names', () => {
    expect(run(['fat'], { roles: ['EXTUSER'], areas: ['warehouse'] })).toBe(false);
    expect(run(['fat'], { roles: ['EXTUSER'], areas: ['fat'] })).toBe(true);
  });

  it('only needs one of several listed areas', () => {
    expect(run(['warehouse', 'fat'], operator(['fat']))).toBe(true);
    expect(run(['warehouse', 'fat'], operator(['config']))).toBe(false);
  });

  it('does not affect routes that name no area', () => {
    expect(run(null, operator([]))).toBe(true);
    expect(run([], operator([]))).toBe(true);
  });

  it('reads the areas from a token, ignoring anything that is not a list', () => {
    expect(userAreas({ areas: ['fat'] })).toEqual(['fat']);
    expect(userAreas({ areas: 'fat' })).toEqual([]);
    expect(userAreas(null)).toEqual([]);
  });
});
