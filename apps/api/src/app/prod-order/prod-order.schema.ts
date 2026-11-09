import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IProdOrder, MRPItemList } from '@webproject/data';

export type ProdOrderDocument = ProdOrder & Document;

@Schema()
export class ProdOrder implements IProdOrder {
  
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  doc_no: string;

  @Prop()
  doc_description: string;

  @Prop()
  source_no: string;

  @Prop()
  description: string;

  @Prop()
  project: string;

  @Prop()
  status: string;

  @Prop()
  location: string;

  @Prop()
  cost_centre: string;

  @Prop()
  expected_due_date: string;

  @Prop()
  qty: number;

  @Prop()
  parent_ref: number;

  @Prop()
  items: MRPItemList[];
}

export const ProdOrderSchema = SchemaFactory.createForClass(ProdOrder);