import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StockkeepingService } from './stockkeeping.service';
import { StockkeepingController } from './stockkeeping.controller';
import { StockkeepingSchema } from './stockkeeping.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'stockkeepings', schema: StockkeepingSchema }])],
  providers: [StockkeepingService],
  controllers: [StockkeepingController],
  exports: [StockkeepingService]
})
export class StockkeepingModule {}
