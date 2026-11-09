import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { ResetPasswordService } from './reset-password.service';

describe('ResetPasswordService', () => {
  let service: ResetPasswordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordService,
        { provide: MailerService, useValue: {} },
      ],
    }).compile();

    service = module.get<ResetPasswordService>(ResetPasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
