import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ReportList } from '@webproject/data';

export type ReportIssuesDocument = ReportIssues & Document;

@Schema()
export class ReportIssues implements ReportList {

  @Prop()
  date: string;

  @Prop({ required: true })
  item_no: string;

  @Prop()
  revision: string;

  @Prop()
  description: string;

  @Prop()
  project: string;

  @Prop()
  doc_no: string;

  @Prop()
  qty_issue: number;

  @Prop()
  issue_type: string;

  @Prop()
  status: string;

  @Prop()
  shp_ref: string;

  @Prop()
  note: string;
}

export const ReportIssuesSchema = SchemaFactory.createForClass(ReportIssues);