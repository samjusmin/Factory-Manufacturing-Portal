import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { IUser, ILocation } from '@webproject/data';
import { Role } from '../role/role.enum';

export type UserDocument = User & Document;

@Schema()
export class User implements IUser {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  location: ILocation[];

  @Prop({ required: true })
  web_token: string;

  @Prop({ required: true })
  company: string;

  @Prop({ required: true })
  roles: Role[];

  // The parts of the app the person works in (warehouse, config, fat). Decides what they can open and which training they need.
  @Prop()
  areas: string[];

  @Prop()
  name: string;
}

export const UserSchema = SchemaFactory.createForClass(User);