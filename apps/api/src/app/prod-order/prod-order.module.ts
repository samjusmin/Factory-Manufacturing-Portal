import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProdOrderService } from './prod-order.service';
import { ProdOrderController } from './prod-order.controller';
import { ProdOrderSchema } from './prod-order.schema';
import { JwtStrategy } from '../auth/jwt.strategy';
import { StockkeepingModule } from '../stockkeeping/stockkeeping.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'prod_orders', schema: ProdOrderSchema }]), StockkeepingModule, UserModule],
  providers: [ProdOrderService, JwtStrategy],
  controllers: [ProdOrderController]
})
export class ProdOrderModule {}
