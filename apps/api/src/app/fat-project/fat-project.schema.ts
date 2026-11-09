import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IFATProject } from '@webproject/data';

export type FATProjectDocument = FATProject & Document;

@Schema()
export class FATProject implements IFATProject  {
  @Prop({ required: true })
  project: string;

  @Prop()
  description: string;

  @Prop()
  location: string;

  @Prop()
  progress: number;

  @Prop()
  phase: Array<IFATProject>;

  @Prop()
  checker_group: Array<String>;

  @Prop()
  numOfUnits: number;
}

export const FATProjectSchema = SchemaFactory.createForClass(FATProject);