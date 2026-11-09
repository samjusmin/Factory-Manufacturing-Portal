import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { Role } from '../role/role.enum';
import { ROLES_KEY } from '../role/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { TrainRegController } from './train-reg.controller';
import { TrainRegService } from './train-reg.service';

describe('TrainRegController', () => {
  let controller: TrainRegController;
  const service = {
    locations: jest.fn().mockResolvedValue(['locations']),
    userDetail: jest.fn().mockResolvedValue('detail'),
    recordCompletion: jest.fn().mockResolvedValue('recorded'),
    clearCompletion: jest.fn().mockResolvedValue('cleared'),
    setAreas: jest.fn().mockResolvedValue('areas'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrainRegController],
      providers: [{ provide: TrainRegService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();

    controller = module.get<TrainRegController>(TrainRegController);
  });

  it('is admin only', () => {
    expect(new Reflector().get(ROLES_KEY, TrainRegController)).toEqual([Role.ADMIN]);
  });

  it('passes each request on to the service', async () => {
    expect(await controller.locations()).toEqual(['locations']);
    expect(await controller.user('sam')).toBe('detail');
    expect(await controller.record('sam', { module: 'RMA Register', date: '2026-01-01' })).toBe('recorded');
    expect(service.recordCompletion).toHaveBeenCalledWith('sam', { module: 'RMA Register', date: '2026-01-01' });
    expect(await controller.clear('sam', 'Picking/Packing')).toBe('cleared');
    expect(service.clearCompletion).toHaveBeenCalledWith('sam', 'Picking/Packing');
    expect(await controller.areas('sam', { areas: ['fat'] })).toBe('areas');
    expect(service.setAreas).toHaveBeenCalledWith('sam', ['fat']);
  });

  it('hands a missing body to the service as no roles, rather than crashing', async () => {
    await controller.areas('sam', undefined);
    expect(service.setAreas).toHaveBeenCalledWith('sam', undefined);
  });
});
