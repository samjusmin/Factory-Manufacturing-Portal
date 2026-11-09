import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ProdOrderSchema } from '../prod-order/prod-order.schema';
import { PurchaseOrderSchema } from '../purchase-order/purchase-order.schema';
import { SubcontractorSchema } from '../subcontractor/subcontractor.schema';
import { StockkeepingSchema } from '../stockkeeping/stockkeeping.schema';
import { FATProjectSchema } from '../fat-project/fat-project.schema';
import { TrainRegSchema } from '../train-reg/train-reg.schema';
import { UserSchema } from '../user/user.schema';
import { FATSchema } from '../factory-acceptance-test/factory-acceptance-test.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'prod_orders', schema: ProdOrderSchema },
      { name: 'purchase_orders', schema: PurchaseOrderSchema },
      { name: 'subcontractors', schema: SubcontractorSchema },
      { name: 'stockkeepings', schema: StockkeepingSchema },
      { name: 'fat_project', schema: FATProjectSchema },
      { name: 'fat_checklist', schema: FATSchema },
      { name: 'training_register', schema: TrainRegSchema },
      { name: 'users', schema: UserSchema },
    ]),
  ],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
