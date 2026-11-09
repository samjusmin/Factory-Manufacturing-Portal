import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IConfigCategory, IConfigCheck, IConfigType } from '@webproject/data';

// A kind of hardware (PC, Network Switch...): how its units look.
export type ConfigCategoryDocument = ConfigCategory & Document;

@Schema()
export class ConfigCategory implements IConfigCategory {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ default: 'box-open' })
  icon: string;

  @Prop({ default: false })
  uses_image: boolean;

  @Prop({ type: [String], default: [] })
  parts: string[];
}

export const ConfigCategorySchema = SchemaFactory.createForClass(ConfigCategory);

// A hardware type (Kiosk A PC, 5-port D-Link...): one category, and the checklist a new unit starts from.
export type ConfigTypeDocument = ConfigType & Document;

@Schema()
export class ConfigType implements IConfigType {
  @Prop({ required: true, index: true })
  category: string;

  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ type: [Object], default: [] })
  checklist: IConfigCheck[];
}

export const ConfigTypeSchema = SchemaFactory.createForClass(ConfigType);
