import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { UserService } from '../user/user.service';
import { ProdOrderService } from './prod-order.service';

describe('ProdOrderService', () => {
  let service: ProdOrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProdOrderService,
        { provide: getModelToken('prod_orders'), useValue: {} },
        { provide: UserService, useValue: {} },
        { provide: REQUEST, useValue: { user: {} } },
        { provide: WINSTON_MODULE_PROVIDER, useValue: {} },
      ],
    }).compile();

    service = module.get<ProdOrderService>(ProdOrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
