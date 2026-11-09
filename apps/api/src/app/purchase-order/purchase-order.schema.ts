import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IPurchaseOrder, ShippingDetail, POItemList } from '@webproject/data';

export type PurchaseOrderDocument = PurchaseOrder & Document;

@Schema()
export class PurchaseOrder implements IPurchaseOrder {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  doc_no: string;

  @Prop()
  vendor: string;

  @Prop()
  vendor_no: string;

  @Prop()
  location: string;

  @Prop()
  status: string;

  @Prop()
  project: string;

  @Prop()
  cost_centre: string;

  @Prop()
  expected_due_date: string;

  @Prop()
  shipping_ref: string;

  @Prop()
  ship_to: ShippingDetail[];

  @Prop()
  items: POItemList[];
}

export const PurchaseOrderSchema = SchemaFactory.createForClass(PurchaseOrder);