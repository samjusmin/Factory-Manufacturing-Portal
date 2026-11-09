import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ITrainReg, TrainingModule } from '@webproject/data';

export type TrainRegDocument = TrainReg & Document;

// One record per user: the modules they have completed, each with the day it was completed.
@Schema()
export class TrainReg implements ITrainReg {
  // The user's username.
  @Prop({ required: true })
  user_id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  training_modules: TrainingModule[];
}

export const TrainRegSchema = SchemaFactory.createForClass(TrainReg);
