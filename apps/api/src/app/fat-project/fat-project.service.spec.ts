import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { FatProjectService } from './fat-project.service';

describe('FatProjectService', () => {
  let service: FatProjectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FatProjectService,
        { provide: getModelToken('fat_project'), useValue: {} },
        { provide: REQUEST, useValue: { user: {} } },
        { provide: WINSTON_MODULE_PROVIDER, useValue: {} },
      ],
    }).compile();

    service = module.get<FatProjectService>(FatProjectService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
