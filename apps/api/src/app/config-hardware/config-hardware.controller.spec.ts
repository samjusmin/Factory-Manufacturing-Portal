import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { AreasGuard } from '../role/areas.guard';
import { Role } from '../role/role.enum';
import { ROLES_KEY } from '../role/roles.decorator';
import { RolesGuard } from '../role/roles.guard';
import { LocationScopeGuard } from '../role/location-scope.guard';
import { ConfigHardwareController } from './config-hardware.controller';
import { ConfigHardwareService } from './config-hardware.service';

describe('ConfigHardwareController', () => {
  let controller: ConfigHardwareController;
  const service = {
    findUnits: jest.fn().mockResolvedValue(['units']),
    findUnit: jest.fn().mockResolvedValue(['unit']),
    create: jest.fn().mockResolvedValue('created'),
    update: jest.fn().mockResolvedValue('updated'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const allow = { canActivate: () => true };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigHardwareController],
      providers: [{ provide: ConfigHardwareService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allow)
      .overrideGuard(AreasGuard).useValue(allow)
      .overrideGuard(RolesGuard).useValue(allow)
      .overrideGuard(LocationScopeGuard).useValue(allow)
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();
    controller = module.get(ConfigHardwareController);
  });

  it('lists the units of a type at a location', async () => {
    expect(await controller.findHardwareUnits('Meridian HQ', 'PC', 'Kiosk A PC')).toEqual(['units']);
    expect(service.findUnits).toHaveBeenCalledWith('Meridian HQ', 'PC', 'Kiosk A PC');
  });

  it('opens, adds and saves a unit', async () => {
    expect(await controller.findHardwareUnit('abc')).toEqual(['unit']);
    expect(await controller.addHardwareUnit({ serial_no: 'S1' })).toBe('created');
    expect(await controller.updateHardwareUnit({ id: 'abc' })).toBe('updated');
    expect(service.findUnit).toHaveBeenCalledWith('abc');
    expect(service.create).toHaveBeenCalledWith({ serial_no: 'S1' });
    expect(service.update).toHaveBeenCalledWith({ id: 'abc' });
  });

  it('is for administrators and operators only, on every route', () => {
    const roles = new Reflector().get(ROLES_KEY, ConfigHardwareController);
    expect(roles).toEqual([Role.ADMIN, Role.OPERATOR]);
  });
});
