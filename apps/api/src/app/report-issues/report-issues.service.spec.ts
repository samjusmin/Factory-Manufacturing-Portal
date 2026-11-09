import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ReportIssuesService } from './report-issues.service';

describe('ReportIssuesService', () => {
  let service: ReportIssuesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportIssuesService,
        { provide: getModelToken('report_issues'), useValue: {} },
        { provide: REQUEST, useValue: { user: {} } },
        { provide: WINSTON_MODULE_PROVIDER, useValue: {} },
      ],
    }).compile();

    service = module.get<ReportIssuesService>(ReportIssuesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
