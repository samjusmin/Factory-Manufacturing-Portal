import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { AreasGuard } from '../role/areas.guard';
import { Role } from '../role/role.enum';
import { ROLES_KEY } from '../role/roles.decorator';
import { RolesGuard } from '../role/roles.guard';
import { HardwareTypeController } from './hardware-type.controller';
import { HardwareTypeService } from './hardware-type.service';

describe('HardwareTypeController', () => {
  let controller: HardwareTypeController;
  const service = {
    findAll: jest.fn().mockResolvedValue(['all']),
    getHardwareList: jest.fn().mockResolvedValue(['list']),
    updateHardwareType: jest.fn().mockResolvedValue('saved'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const allow = { canActivate: () => true };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HardwareTypeController],
      providers: [{ provide: HardwareTypeService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allow)
      .overrideGuard(AreasGuard).useValue(allow)
      .overrideGuard(RolesGuard).useValue(allow)
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();
    controller = module.get(HardwareTypeController);
  });

  it('lists the hardware models and saves one, returning what was saved', async () => {
    expect(await controller.getAllHardwareTypes()).toEqual(['all']);
    expect(await controller.getHardwareList()).toEqual(['list']);
    expect(await controller.updateHardwareType({ name: 'Dell', config_type: ['PC'] })).toBe('saved');
    expect(service.updateHardwareType).toHaveBeenCalledWith({ name: 'Dell', config_type: ['PC'] });
  });

  it('is for administrators only', () => {
    const reflector = new Reflector();
    ['getAllHardwareTypes', 'getHardwareList', 'updateHardwareType']
      .forEach((m) => expect(reflector.get(ROLES_KEY, (HardwareTypeController.prototype as any)[m])).toEqual([Role.ADMIN]));
  });
});
