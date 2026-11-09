import { Test, TestingModule } from '@nestjs/testing';
import { FatProjectController } from './fat-project.controller';
import { FatProjectService } from './fat-project.service';
import { ErrorInterceptor } from '../error/error.interceptor';

describe('FatProjectController', () => {
  let controller: FatProjectController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FatProjectController],
      providers: [{ provide: FatProjectService, useValue: {} }],
    })
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();

    controller = module.get<FatProjectController>(FatProjectController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
