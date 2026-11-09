import { Test, TestingModule } from '@nestjs/testing';
import { ProdOrderController } from './prod-order.controller';
import { ProdOrderService } from './prod-order.service';
import { StockkeepingService } from '../stockkeeping/stockkeeping.service';
import { ErrorInterceptor } from '../error/error.interceptor';

describe('ProdOrderController', () => {
  let controller: ProdOrderController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProdOrderController],
      providers: [{ provide: ProdOrderService, useValue: {} }, { provide: StockkeepingService, useValue: {} }],
    })
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();

    controller = module.get<ProdOrderController>(ProdOrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
