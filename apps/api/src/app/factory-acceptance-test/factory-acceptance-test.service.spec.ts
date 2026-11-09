import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { FatProjectService } from '../fat-project/fat-project.service';
import { FactoryAcceptanceTestService } from './factory-acceptance-test.service';

describe('FactoryAcceptanceTestService', () => {
  let service: FactoryAcceptanceTestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FactoryAcceptanceTestService,
        { provide: getModelToken('fat_checklist'), useValue: {} },
        { provide: getModelToken('users'), useValue: {} },
        { provide: REQUEST, useValue: { user: {} } },
        { provide: WINSTON_MODULE_PROVIDER, useValue: {} },
        { provide: FatProjectService, useValue: {} },
      ],
    }).compile();

    service = module.get<FactoryAcceptanceTestService>(FactoryAcceptanceTestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
