import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IConfigLocation, IConfigHardware } from '@webproject/data';

export type ConfigLocationDocument = ConfigLocation & Document;

// A place that configures hardware: what it may configure (item_access), which PC images and hardware models it may
// pick, and the project codes its units can be allocated to (besides the STOCK every location has).
@Schema()
export class ConfigLocation implements IConfigLocation {
  @Prop({ required: true })
  location: string;

  @Prop({ type: [Object], default: [] })
  item_access: IConfigHardware[];

  @Prop({ type: [String], default: [] })
  image_access: string[];

  @Prop({ type: [String], default: [] })
  hardware_access: string[];

  @Prop({ type: [String], default: [] })
  projects: string[];
}

export const ConfigLocationSchema = SchemaFactory.createForClass(ConfigLocation);
