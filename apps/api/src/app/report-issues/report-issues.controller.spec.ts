import { Test, TestingModule } from '@nestjs/testing';
import { ReportIssuesController } from './report-issues.controller';
import { ReportIssuesService } from './report-issues.service';
import { MailService } from '../mail/mail.service';
import { ErrorInterceptor } from '../error/error.interceptor';

describe('ReportIssuesController', () => {
  let controller: ReportIssuesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportIssuesController],
      providers: [{ provide: ReportIssuesService, useValue: {} }, { provide: MailService, useValue: {} }],
    })
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();

    controller = module.get<ReportIssuesController>(ReportIssuesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
