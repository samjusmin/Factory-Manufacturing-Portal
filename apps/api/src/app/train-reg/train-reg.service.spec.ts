import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TrainRegService } from './train-reg.service';

const TODAY = '2026-11-03';

const exec = (value: any) => ({ exec: () => Promise.resolve(value), lean: () => ({ exec: () => Promise.resolve(value) }) });

const HQ = { code: 'WH-SYD-A1', name: 'Meridian HQ' };
const PA = { code: 'SUB-PA-01', name: 'Partner A' };
const PB = { code: 'SUB-PB-01', name: 'Partner B' };

async function build(users: any[], records: any[], locations: any[] = [{ location: 'Meridian HQ' }, { location: 'Partner A' }, { location: 'Empty Site' }]) {
  const train = {
    find: jest.fn().mockReturnValue(exec(records)),
    findOne: jest.fn().mockImplementation(q => exec(records.find(r => r.user_id === q.user_id) || null)),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const user = {
    find: jest.fn().mockReturnValue(exec(users)),
    findOne: jest.fn().mockImplementation(q => exec(users.find(u => u.username === q.username) || null)),
    updateOne: jest.fn().mockResolvedValue({}),
  };
  const location = { find: jest.fn().mockReturnValue(exec(locations)) };
  const module = await Test.createTestingModule({
    providers: [
      TrainRegService,
      { provide: getModelToken('training_register'), useValue: train },
      { provide: getModelToken('users'), useValue: user },
      { provide: getModelToken('config_location'), useValue: location },
    ],
  }).compile();
  return { service: module.get(TrainRegService), train, user };
}

describe('TrainRegService', () => {
  const people = () => [
    { username: 'sam', name: 'Sam', roles: ['OPERATOR'], location: [HQ], areas: ['warehouse'] },
    { username: 'ravi', name: 'Ravi Menon', location: [PA, PB], areas: ['fat'] },
    { username: 'kim', location: [HQ], areas: [] },
  ];

  describe('locations', () => {
    it('lists every location, including ones nobody is registered at, sorted by name', async () => {
      const { service } = await build(people(), []);
      const result = await service.locations(TODAY);
      expect(result.map(l => l.location)).toEqual(['Empty Site', 'Meridian HQ', 'Partner A', 'Partner B']);
      expect(result[0].users).toEqual([]);
    });

    it('shows a person at each location they are registered at, with their summary', async () => {
      const { service } = await build(people(), []);
      const result = await service.locations(TODAY);
      const at = (name: string) => result.find(l => l.location === name).users.map(u => u.username);
      expect(at('Partner A')).toEqual(['ravi']);
      expect(at('Partner B')).toEqual(['ravi']);
      expect(at('Meridian HQ')).toEqual(['kim', 'sam']);   // sorted by display name: Kim, Sam
      const sam = result.find(l => l.location === 'Meridian HQ').users.find(u => u.username === 'sam');
      expect(sam.counts).toEqual({ required: 6, valid: 0, dueSoon: 0, expired: 0, missing: 6 });
      expect(sam.state).toBe('attention');
    });

    it('falls back to the capitalised username when a user has no name, and shows a no-role person as none', async () => {
      const { service } = await build(people(), []);
      const kim = (await service.locations(TODAY)).find(l => l.location === 'Meridian HQ').users.find(u => u.username === 'kim');
      expect(kim.name).toBe('Kim');
      expect(kim.state).toBe('none');
      expect(kim.counts.required).toBe(0);
    });

    it('uses the modules a person has completed', async () => {
      const done = ['Warehouse Safety Induction', 'Walkie Stacker & Pallet Jack', 'Internal Receiving Compliance', 'Picking/Packing', 'Stock Management', 'RMA Register']
        .map(module => ({ module, date: '2026-06-01' }));
      const { service } = await build(people(), [{ user_id: 'sam', training_modules: done }]);
      const sam = (await service.locations(TODAY)).find(l => l.location === 'Meridian HQ').users.find(u => u.username === 'sam');
      expect(sam.state).toBe('current');
      expect(sam.percentCurrent).toBe(100);
    });
  });

  describe('userDetail', () => {
    it('returns the person with their locations, roles and per-module dates', async () => {
      const { service } = await build(people(), [{ user_id: 'ravi', training_modules: [{ module: 'Kiosk Commissioning', date: '2023-01-10' }] }]);
      const detail = await service.userDetail('Ravi ', TODAY);
      expect(detail.username).toBe('ravi');
      expect(detail.locations).toEqual(['Partner A', 'Partner B']);
      expect(detail.areas).toEqual(['fat']);
      const fat = detail.summary.areas.find(a => a.area === 'fat');
      const kiosk = fat.modules.find(m => m.module === 'Kiosk Commissioning');
      expect(kiosk.status).toEqual(expect.objectContaining({ state: 'expired', completedOn: '2023-01-10', renewsOn: '2025-01-10' }));
    });

    it('includes the sign-in roles, and none when a user has none stored', async () => {
      const { service } = await build(people(), []);
      expect((await service.userDetail('sam', TODAY)).roles).toEqual(['OPERATOR']);
      expect((await service.userDetail('kim', TODAY)).roles).toEqual([]);
      const sam = (await service.locations(TODAY)).find(l => l.location === 'Meridian HQ').users.find(u => u.username === 'sam');
      expect(sam.roles).toEqual(['OPERATOR']);
    });

    it('rejects an unknown user', async () => {
      const { service } = await build(people(), []);
      await expect(service.userDetail('nobody', TODAY)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('recordCompletion', () => {
    it('replaces the earlier record of the same module and keeps the others', async () => {
      const existing = [{ module: 'Stock Management', date: '2023-01-01' }, { module: 'RMA Register', date: '2026-01-01' }];
      const { service, train } = await build(people(), [{ user_id: 'sam', training_modules: existing }]);
      await service.recordCompletion('sam', { module: 'Stock Management', date: '2026-10-30' }, TODAY);
      const [filter, update, options] = train.updateOne.mock.calls[0];
      expect(filter).toEqual({ user_id: 'sam' });
      expect(update.$set.training_modules).toEqual([
        { module: 'RMA Register', date: '2026-01-01' },
        { module: 'Stock Management', date: '2026-10-30' },
      ]);
      expect(update.$set.name).toBe('Sam');
      expect(options).toEqual({ upsert: true });
    });

    it('creates the record of a person who has none', async () => {
      const { service, train } = await build(people(), []);
      await service.recordCompletion('sam', { module: 'RMA Register', date: TODAY }, TODAY);
      expect(train.updateOne.mock.calls[0][1].$set.training_modules).toEqual([{ module: 'RMA Register', date: TODAY }]);
    });

    it('accepts today but not a day in the future', async () => {
      const { service, train } = await build(people(), []);
      await service.recordCompletion('sam', { module: 'RMA Register', date: TODAY }, TODAY);
      await expect(service.recordCompletion('sam', { module: 'RMA Register', date: '2026-11-04' }, TODAY)).rejects.toThrow('future');
      expect(train.updateOne).toHaveBeenCalledTimes(1);
    });

    it('rejects an unknown module, a bad date, a missing body and an unknown user without writing', async () => {
      const { service, train } = await build(people(), []);
      await expect(service.recordCompletion('sam', { module: 'Basket Weaving', date: TODAY }, TODAY)).rejects.toBeInstanceOf(BadRequestException);
      for (const date of ['yesterday', '2026-13-45', '03/11/2026', '', undefined]) {
        await expect(service.recordCompletion('sam', { module: 'RMA Register', date }, TODAY)).rejects.toBeInstanceOf(BadRequestException);
      }
      await expect(service.recordCompletion('sam', undefined, TODAY)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.recordCompletion('nobody', { module: 'RMA Register', date: TODAY }, TODAY)).rejects.toBeInstanceOf(NotFoundException);
      expect(train.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('clearCompletion', () => {
    it('removes the module record', async () => {
      const { service, train } = await build(people(), [{ user_id: 'sam', training_modules: [{ module: 'Picking/Packing', date: '2026-01-01' }] }]);
      await service.clearCompletion('sam', 'Picking/Packing', TODAY);
      expect(train.updateOne).toHaveBeenCalledWith({ user_id: 'sam' }, { $pull: { training_modules: { module: 'Picking/Packing' } } });
    });

    it('rejects an unknown module or user', async () => {
      const { service, train } = await build(people(), []);
      await expect(service.clearCompletion('sam', 'Nope', TODAY)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.clearCompletion('nobody', 'RMA Register', TODAY)).rejects.toBeInstanceOf(NotFoundException);
      expect(train.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('setAreas', () => {
    it('saves the roles in the standard order, without duplicates', async () => {
      const { service, user } = await build(people(), []);
      await service.setAreas('sam', ['fat', 'warehouse', 'fat'], TODAY);
      expect(user.updateOne).toHaveBeenCalledWith({ username: 'sam' }, { $set: { areas: ['warehouse', 'fat'] } });
    });

    it('allows removing every role', async () => {
      const { service, user } = await build(people(), []);
      await service.setAreas('sam', [], TODAY);
      expect(user.updateOne).toHaveBeenCalledWith({ username: 'sam' }, { $set: { areas: [] } });
    });

    it('rejects an unknown role, a non-list and an unknown user without writing', async () => {
      const { service, user } = await build(people(), []);
      await expect(service.setAreas('sam', ['warehouse', 'admin'], TODAY)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setAreas('sam', 'warehouse', TODAY)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setAreas('sam', undefined, TODAY)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.setAreas('nobody', ['fat'], TODAY)).rejects.toBeInstanceOf(NotFoundException);
      expect(user.updateOne).not.toHaveBeenCalled();
    });
  });
});
