import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IConfigCheck, IConfigUnitPart, STOCK_PROJECT } from '@webproject/data';

export type ConfigHardwareDocument = ConfigHardware & Document;

// One piece of hardware at a location. Its serial no. is what identifies it; `project` says what it is for, or STOCK
// while it is not allocated.
@Schema()
export class ConfigHardware {
  @Prop({ required: true })
  location: string;

  @Prop({ required: true })
  hardware_category: string;

  @Prop({ required: true })
  hardware_type: string;

  @Prop({ required: true, trim: true })
  serial_no: string;

  @Prop({ default: STOCK_PROJECT })
  project: string;

  @Prop()
  device_name: string;

  @Prop()
  model: string;

  // Only for categories that use a PC image.
  @Prop()
  pc_image: string;

  // The extra parts a category defines (a UNIT-W1 set's members), each with its own serial no.
  @Prop({ type: [Object], default: [] })
  parts: IConfigUnitPart[];

  // The share of the checklist's checks that are done, always worked out by the server.
  @Prop({ default: 0 })
  progress: number;

  // Goes up on every save, so a save made from an older copy is refused instead of overwriting a newer one.
  @Prop({ default: 0 })
  version: number;

  @Prop({ type: [Object], default: [] })
  checklist: IConfigCheck[];
}

export const ConfigHardwareSchema = SchemaFactory.createForClass(ConfigHardware);
