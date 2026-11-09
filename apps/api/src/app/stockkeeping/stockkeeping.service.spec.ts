import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { StockkeepingService } from './stockkeeping.service';

describe('StockkeepingService', () => {
  let service: StockkeepingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockkeepingService,
        { provide: getModelToken('stockkeepings'), useValue: {} },
        { provide: REQUEST, useValue: { user: {} } },
        { provide: WINSTON_MODULE_PROVIDER, useValue: {} },
      ],
    }).compile();

    service = module.get<StockkeepingService>(StockkeepingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
