import { Model } from 'mongoose';
import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './user.schema';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

var request = require('request');
var username = '';

@Injectable()
export class UserService {
    constructor(
        @InjectModel('users') private UserModel: Model<UserDocument>,
        @Inject(REQUEST) private request: Request,
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
    ) {}

    async getInfo(reqname: string): Promise<User[]> {
        return this.UserModel.find({ username: reqname.toLowerCase() }).exec();
    }

    async getLocations() {
        username = this.request.user['username'];
        let locList = [];
        let locObj = await this.UserModel.find({ username: username }, { "location": 1 }).exec();
        locObj[0].location.forEach(element => {
            locList.push(element.name);
        });

        return locList;
    }

    async checkLoc(reqname: string, location: string): Promise<User[]> {
        return this.UserModel.find({ username: reqname, "location.name": location}, { "location.$": 1 }).exec();
    }
}
