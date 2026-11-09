import { Model } from 'mongoose';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ITrainingLocation,
  ITrainingUserDetail,
  ITrainingUserRow,
  TrainingArea,
  cleanAreas,
  isTrainingArea,
  isTrainingModule,
  localIsoDate,
  summariseTraining,
} from '@webproject/data';
import { TrainRegDocument } from './train-reg.schema';
import { UserDocument } from '../user/user.schema';
import { ConfigLocationDocument } from '../config-location/config-location.schema';

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// The training register: who is registered at each location, which roles they hold, and where their training stands.
// A person's roles live on the user (they also decide what the person can open); the modules they have completed live
// in the training register, one record per user. Renewal dates and statuses are worked out when asked for, from the
// completion date (see training-status.ts), so nothing here can go stale.
@Injectable()
export class TrainRegService {
  constructor(
    @InjectModel('training_register') private TrainModel: Model<TrainRegDocument>,
    @InjectModel('users') private UserModel: Model<UserDocument>,
    @InjectModel('config_location') private LocationModel: Model<ConfigLocationDocument>,
  ) {}

  private displayName(user: any): string {
    return user.name || capitalise(user.username || '');
  }

  private userRow(user: any, record: any, today: string): ITrainingUserRow {
    const summary = summariseTraining(user.areas, record ? record.training_modules : [], today);
    return {
      username: user.username,
      name: this.displayName(user),
      roles: user.roles || [],
      areas: cleanAreas(user.areas),
      counts: summary.counts,
      state: summary.state,
      percentCurrent: summary.percentCurrent,
    };
  }

  // Every location with the people registered there. A location with nobody still appears. A person registered at
  // two locations appears under both.
  async locations(today: string = localIsoDate()): Promise<ITrainingLocation[]> {
    const [users, records, configured] = await Promise.all([
      this.UserModel.find({}).lean().exec() as Promise<any[]>,
      this.TrainModel.find({}).lean().exec() as Promise<any[]>,
      this.LocationModel.find({}, { location: 1 }).lean().exec() as Promise<any[]>,
    ]);
    const recordOf = new Map<string, any>(records.map(r => [r.user_id, r] as [string, any]));

    const byLocation = new Map<string, ITrainingUserRow[]>();
    configured.forEach(l => l.location && byLocation.set(l.location, []));
    users.forEach(user => {
      const row = this.userRow(user, recordOf.get(user.username), today);
      (user.location || []).forEach(l => {
        if (l && l.name) {
          byLocation.set(l.name, (byLocation.get(l.name) || []).concat(row));
        }
      });
    });

    return Array.from(byLocation.keys()).sort((a, b) => a.localeCompare(b)).map(location => ({
      location,
      users: byLocation.get(location).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }

  // One person in full: their roles, and every module they must do with its dates and status.
  async userDetail(username: string, today: string = localIsoDate()): Promise<ITrainingUserDetail> {
    const name = (username || '').trim().toLowerCase();
    const user: any = await this.UserModel.findOne({ username: name }).lean().exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const record: any = await this.TrainModel.findOne({ user_id: name }).lean().exec();
    return {
      username: user.username,
      name: this.displayName(user),
      roles: user.roles || [],
      locations: (user.location || []).map(l => l.name).filter(n => n),
      areas: cleanAreas(user.areas),
      summary: summariseTraining(user.areas, record ? record.training_modules : [], today),
    };
  }

  // Records that a module was completed on a date, replacing any earlier record of the same module.
  async recordCompletion(username: string, body: { module?: string, date?: string }, today: string = localIsoDate()) {
    const name = (username || '').trim().toLowerCase();
    const module = body && body.module;
    const date = body && body.date;
    if (!isTrainingModule(module)) {
      throw new BadRequestException('Unknown training module');
    }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date + 'T00:00:00Z'))) {
      throw new BadRequestException('The completion date must be a date such as 2026-11-03');
    }
    if (date > today) {
      throw new BadRequestException('A module cannot be completed on a date in the future');
    }
    const user: any = await this.UserModel.findOne({ username: name }).lean().exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const record: any = await this.TrainModel.findOne({ user_id: name }).lean().exec();
    const modules = ((record && record.training_modules) || []).filter(m => m.module !== module).concat({ module, date });
    await this.TrainModel.updateOne(
      { user_id: name },
      { $set: { user_id: name, name: this.displayName(user), training_modules: modules } },
      { upsert: true },
    );
    return this.userDetail(name, today);
  }

  // Removes a module's completion record, so the module counts as not done.
  async clearCompletion(username: string, module: string, today: string = localIsoDate()) {
    const name = (username || '').trim().toLowerCase();
    if (!isTrainingModule(module)) {
      throw new BadRequestException('Unknown training module');
    }
    const user: any = await this.UserModel.findOne({ username: name }).lean().exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.TrainModel.updateOne({ user_id: name }, { $pull: { training_modules: { module } } });
    return this.userDetail(name, today);
  }

  // Sets the roles a person holds. They give access to that part of the app (from the person's next sign-in) and
  // require that role's training.
  async setAreas(username: string, areas: any, today: string = localIsoDate()) {
    const name = (username || '').trim().toLowerCase();
    if (!Array.isArray(areas)) {
      throw new BadRequestException('Roles must be a list');
    }
    const unknown = areas.find(a => !isTrainingArea(a));
    if (unknown !== undefined) {
      throw new BadRequestException('Unknown role: ' + unknown);
    }
    const user: any = await this.UserModel.findOne({ username: name }).lean().exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const clean: TrainingArea[] = cleanAreas(areas);
    await this.UserModel.updateOne({ username: name }, { $set: { areas: clean } });
    return this.userDetail(name, today);
  }
}
