import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ISubcontractor } from '@webproject/data';

export type SubcontractorDocument = Subcontractor & Document;

@Schema()
export class Subcontractor implements ISubcontractor {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  location: [{loc: string}];

  @Prop({ required: true })
  vendor: [{vendor_no: string}];
}

export const SubcontractorSchema = SchemaFactory.createForClass(Subcontractor);