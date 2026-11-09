import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IFactoryTest, CheckList, Options } from '@webproject/data';
import { FATcategory } from './factory-acceptance-test.update.dto';

export type FATDocument = FAT & Document;

@Schema()
export class FAT implements IFactoryTest {
  @Prop({ required: true })
  doc_no: string;

  @Prop()
  unit_no: string;

  @Prop({ required: true })
  project: string;

  @Prop({ required: true })
  phase: string;

  @Prop()
  location: string;

  @Prop({ required: true })
  unit_type: string;

  @Prop()
  variant: string;

  @Prop()
  checker: string;

  @Prop()
  opt_honeywell: number;

  @Prop()
  opt_printer: number;

  @Prop()
  options: Array<string>;

  @Prop()
  comment: string;

  @Prop()
  category: Array<FATcategory>;

  @Prop()
  progress: number;
}

export const FATSchema = SchemaFactory.createForClass(FAT);

// Deep Search filters on these, so the database can find the matching units without reading every one.
FATSchema.index({ project: 1, phase: 1 });
FATSchema.index({ unit_type: 1 });
FATSchema.index({ location: 1 });
FATSchema.index({ doc_no: 1 });
