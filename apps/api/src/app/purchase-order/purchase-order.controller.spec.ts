import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderService } from './purchase-order.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';

describe('PurchaseOrderController', () => {
  let controller: PurchaseOrderController;
  const service = {
    findAll: jest.fn().mockResolvedValue(['receiving']),
    findOrders: jest.fn().mockResolvedValue(['orders']),
    findPO: jest.fn().mockResolvedValue(['receiving detail']),
    findPOForOrders: jest.fn().mockResolvedValue(['order detail']),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrderController],
      providers: [{ provide: PurchaseOrderService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideInterceptor(ErrorInterceptor).useValue({ intercept: (_context, next) => next.handle() })
      .compile();

    controller = module.get<PurchaseOrderController>(PurchaseOrderController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('serves the Receiving list and the Orders list from different service methods', async () => {
    expect(await controller.getAllProducts()).toEqual(['receiving']);
    expect(await controller.getAllOrders()).toEqual(['orders']);
  });

  it('serves the receiving detail and the read-only order detail from different service methods', async () => {
    expect(await controller.findOne('PO-1')).toEqual(['receiving detail']);
    expect(await controller.findOneOrder('PO-1')).toEqual(['order detail']);
    expect(service.findPOForOrders).toHaveBeenCalledWith('PO-1');
  });
});
