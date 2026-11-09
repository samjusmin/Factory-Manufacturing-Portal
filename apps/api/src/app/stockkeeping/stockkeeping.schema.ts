import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IStockkeeping } from '@webproject/data';

export type StockkeepingDocument = Stockkeeping & Document;

@Schema()
export class Stockkeeping implements IStockkeeping {
  @Prop({ required: true })
  no: string;

  @Prop()
  variant: string;

  @Prop({ required: true })
  location: string;

  @Prop()
  description: string;

  @Prop()
  inventory: number;

  @Prop()
  reorder_point: number;

  @Prop()
  reorder_qty: number;

  @Prop()
  replenishment_system: string;
}

export const StockkeepingSchema = SchemaFactory.createForClass(Stockkeeping);