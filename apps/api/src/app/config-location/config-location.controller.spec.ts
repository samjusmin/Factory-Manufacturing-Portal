import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { AreasGuard } from '../role/areas.guard';
import { LocationScopeGuard } from '../role/location-scope.guard';
import { Role } from '../role/role.enum';
import { ROLES_KEY } from '../role/roles.decorator';
import { RolesGuard } from '../role/roles.guard';
import { HardwareTypeService } from '../hardware-type/hardware-type.service';
import { PcImageService } from '../pc-image/pc-image.service';
import { ConfigLocationController } from './config-location.controller';
import { ConfigLocationService } from './config-location.service';

describe('ConfigLocationController', () => {
  let controller: ConfigLocationController;
  const locations = {
    findAll: jest.fn().mockResolvedValue(['all']),
    findByNames: jest.fn().mockResolvedValue(['mine']),
    getAccessibleHardwareIDs: jest.fn().mockResolvedValue(['m1']),
    getImageAccess: jest.fn().mockResolvedValue(['i1']),
    addEntry: jest.fn().mockResolvedValue('added'),
    updateEntry: jest.fn().mockResolvedValue('updated'),
  };
  const hardwareTypes = { getAccessibleByCategory: jest.fn().mockResolvedValue([{ name: 'Dell 7000' }]) };
  const images = { getImageByIds: jest.fn().mockResolvedValue([{ name: 'KioskA_v3' }]) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const allow = { canActivate: () => true };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigLocationController],
      providers: [
        { provide: ConfigLocationService, useValue: locations },
        { provide: HardwareTypeService, useValue: hardwareTypes },
        { provide: PcImageService, useValue: images },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(allow)
      .overrideGuard(AreasGuard).useValue(allow)
      .overrideGuard(RolesGuard).useValue(allow)
      .overrideGuard(LocationScopeGuard).useValue(allow)
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();
    controller = module.get(ConfigLocationController);
  });

  it('lists every location, and only the caller\'s own for "mine"', async () => {
    expect(await controller.getAllLocations()).toEqual(['all']);
    const user = { location: [{ name: 'Meridian HQ' }, { name: 'Partner A' }] };
    expect(await controller.getMyLocations({ user })).toEqual(['mine']);
    expect(locations.findByNames).toHaveBeenCalledWith(['Meridian HQ', 'Partner A']);
  });

  it('gives the models a location may use for a category', async () => {
    expect(await controller.getAccessibleHardware('Meridian HQ', 'PC')).toEqual([{ name: 'Dell 7000' }]);
    expect(hardwareTypes.getAccessibleByCategory).toHaveBeenCalledWith(['m1'], 'PC');
  });

  it('gives the images a location may use for a type, even when the location is unknown', async () => {
    expect(await controller.getAccessibleImages('Meridian HQ', 'Kiosk A PC')).toEqual([{ name: 'KioskA_v3' }]);
    expect(images.getImageByIds).toHaveBeenCalledWith(['i1'], 'Kiosk A PC');
    locations.getImageAccess.mockResolvedValueOnce([]);
    await controller.getAccessibleImages('Nowhere', 'Kiosk A PC');
    expect(images.getImageByIds).toHaveBeenLastCalledWith([], 'Kiosk A PC');
  });

  it('adds a location only for an ENTRY, and saves an update', async () => {
    expect(await controller.addEntry({ type: 'ENTRY', data: { location: 'X' } })).toBe('added');
    expect(locations.addEntry).toHaveBeenCalledWith({ location: 'X' });
    expect(await controller.addEntry({ type: 'OTHER' })).toBeUndefined();
    expect(await controller.updateEntry({ type: 'UPDATE', data: { location: 'X', projects: ['PRJ'] } })).toBe('updated');
    expect(locations.updateEntry).toHaveBeenCalledWith({ location: 'X', projects: ['PRJ'] });
  });

  it('lets only administrators list, add and change locations', () => {
    const reflector = new Reflector();
    const rolesOf = (method: string) => reflector.get(ROLES_KEY, (ConfigLocationController.prototype as any)[method]);
    ['getAllLocations', 'addEntry', 'updateEntry'].forEach((m) => expect(rolesOf(m)).toEqual([Role.ADMIN]));
  });
});
