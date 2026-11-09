import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderSchema } from './purchase-order.schema';
import { SubcontractorSchema } from '../subcontractor/subcontractor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'purchase_orders', schema: PurchaseOrderSchema }]),
    MongooseModule.forFeature([{ name: 'subcontractors', schema: SubcontractorSchema }])
  ],
  providers: [PurchaseOrderService],
  controllers: [PurchaseOrderController]
})
export class PurchaseOrderModule {}
