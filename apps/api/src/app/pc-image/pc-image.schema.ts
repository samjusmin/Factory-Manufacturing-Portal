import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IPcImage } from '@webproject/data';

export type PcImageDocument = PcImage & Document;

@Schema()
export class PcImage implements IPcImage {
  // @Prop({ required: true })
  // _id: string;

  @Prop()
  id: string;
  
  @Prop()
  name: string;

  @Prop()
  description: string;

  @Prop()
  date_created: string;

  @Prop()
  added_by: string;

  @Prop()
  responsible_person: string;

  @Prop()
  pc_type: string;

}

export const PcImageSchema = SchemaFactory.createForClass(PcImage);