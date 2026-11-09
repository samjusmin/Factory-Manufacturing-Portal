import { Test, TestingModule } from '@nestjs/testing';
import { StockkeepingController } from './stockkeeping.controller';
import { StockkeepingService } from './stockkeeping.service';
import { ErrorInterceptor } from '../error/error.interceptor';

describe('StockkeepingController', () => {
  let controller: StockkeepingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockkeepingController],
      providers: [{ provide: StockkeepingService, useValue: {} }],
    })
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();

    controller = module.get<StockkeepingController>(StockkeepingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
