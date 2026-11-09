import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { AreasGuard } from '../role/areas.guard';
import { Role } from '../role/role.enum';
import { ROLES_KEY } from '../role/roles.decorator';
import { RolesGuard } from '../role/roles.guard';
import { PcImageController } from './pc-image.controller';
import { PcImageService } from './pc-image.service';

describe('PcImageController', () => {
  let controller: PcImageController;
  const service = {
    findAll: jest.fn().mockResolvedValue(['all']),
    getImageTree: jest.fn().mockResolvedValue(['tree']),
    findByType: jest.fn().mockResolvedValue(['images']),
    updateImage: jest.fn().mockResolvedValue('saved'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const allow = { canActivate: () => true };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PcImageController],
      providers: [{ provide: PcImageService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allow)
      .overrideGuard(AreasGuard).useValue(allow)
      .overrideGuard(RolesGuard).useValue(allow)
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();
    controller = module.get(PcImageController);
  });

  it('lists the images, the tree of them, or the ones for one type', async () => {
    expect(await controller.getAllPcImages()).toEqual(['all']);
    expect(await controller.getTypePCImages('tree')).toEqual(['tree']);
    expect(await controller.getTypePCImages('Kiosk A PC')).toEqual(['images']);
    expect(service.findByType).toHaveBeenCalledWith('Kiosk A PC');
  });

  it('saves an image, returning what was saved', async () => {
    expect(await controller.updatePcImage({ name: 'KioskA_v4' })).toBe('saved');
    expect(service.updateImage).toHaveBeenCalledWith({ name: 'KioskA_v4' });
  });

  it('is for administrators only', () => {
    const reflector = new Reflector();
    ['getAllPcImages', 'getTypePCImages', 'updatePcImage']
      .forEach((m) => expect(reflector.get(ROLES_KEY, (PcImageController.prototype as any)[m])).toEqual([Role.ADMIN]));
  });
});
