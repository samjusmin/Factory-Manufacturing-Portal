import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IHardwareType } from '@webproject/data';

export type HardwareTypeDocument = HardwareType & Document;

@Schema()
export class HardwareType implements IHardwareType {
  
  @Prop({ required: true })
  _id: string;

  @Prop()
  name: string;

  @Prop()
  config_type: Array<string>;

}

export const HardwareTypeSchema = SchemaFactory.createForClass(HardwareType);