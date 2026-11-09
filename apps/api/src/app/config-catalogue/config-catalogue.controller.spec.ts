import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { AreasGuard } from '../role/areas.guard';
import { Role } from '../role/role.enum';
import { ROLES_KEY } from '../role/roles.decorator';
import { RolesGuard } from '../role/roles.guard';
import { ConfigCatalogueController } from './config-catalogue.controller';
import { ConfigCatalogueService } from './config-catalogue.service';

describe('ConfigCatalogueController', () => {
  let controller: ConfigCatalogueController;
  const service = {
    catalogue: jest.fn().mockResolvedValue('catalogue'),
    imageTypes: jest.fn().mockResolvedValue(['Kiosk A PC']),
    getType: jest.fn().mockResolvedValue('type'),
    createCategory: jest.fn().mockResolvedValue('created'),
    updateCategory: jest.fn().mockResolvedValue('updated'),
    deleteCategory: jest.fn().mockResolvedValue('deleted'),
    createType: jest.fn().mockResolvedValue('createdType'),
    deleteType: jest.fn().mockResolvedValue('deletedType'),
    saveChecklist: jest.fn().mockResolvedValue('saved'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const allow = { canActivate: () => true };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigCatalogueController],
      providers: [{ provide: ConfigCatalogueService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard).useValue(allow)
      .overrideGuard(AreasGuard).useValue(allow)
      .overrideGuard(RolesGuard).useValue(allow)
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();
    controller = module.get(ConfigCatalogueController);
  });

  it('lists the catalogue, the image types and a type', async () => {
    expect(await controller.list()).toBe('catalogue');
    expect(await controller.imageTypes()).toEqual(['Kiosk A PC']);
    expect(await controller.getType('Kiosk A PC')).toBe('type');
    expect(service.getType).toHaveBeenCalledWith('Kiosk A PC');
  });

  it('passes the changes on to the service', async () => {
    expect(await controller.createCategory({ name: 'X' })).toBe('created');
    expect(await controller.updateCategory('X', { icon: 'tools' })).toBe('updated');
    expect(await controller.deleteCategory('X')).toBe('deleted');
    expect(await controller.createType({ category: 'X', name: 'Y' })).toBe('createdType');
    expect(await controller.deleteType('Y')).toBe('deletedType');
    expect(await controller.saveChecklist('Y', { checklist: [{ description: 'a' }] })).toBe('saved');
    expect(service.saveChecklist).toHaveBeenCalledWith('Y', [{ description: 'a' }]);
    expect(await controller.saveChecklist('Y', undefined)).toBe('saved');
  });

  it('lets operators read but only administrators change', () => {
    const reflector = new Reflector();
    const rolesOf = (method: string) => reflector.get(ROLES_KEY, (ConfigCatalogueController.prototype as any)[method]);
    ['list', 'imageTypes', 'getType'].forEach((m) => expect(rolesOf(m)).toEqual([Role.ADMIN, Role.OPERATOR]));
    ['createCategory', 'updateCategory', 'deleteCategory', 'createType', 'deleteType', 'saveChecklist']
      .forEach((m) => expect(rolesOf(m)).toEqual([Role.ADMIN]));
  });
});
