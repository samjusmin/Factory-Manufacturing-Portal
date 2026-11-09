import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { localIsoDate } from '@webproject/data';
import { DashboardService } from './dashboard.service';

// An order due the given number of days from today, with lines given as [qty, received, remaining].
const order = (status: string, offset: number, lines: [number, number, number][]) => {
  const due = new Date();
  due.setDate(due.getDate() + offset);
  return {
    status,
    expected_due_date: localIsoDate(due),
    items: lines.map(([qty, received, remaining]) => ({ qty, qty_received: received, qty_remaining: remaining })),
  };
};

const exec = (value: any) => ({ exec: () => Promise.resolve(value), lean: () => ({ exec: () => Promise.resolve(value) }) });

function modelMock(overrides: any = {}) {
  return {
    countDocuments: jest.fn().mockReturnValue(exec(0)),
    find: jest.fn().mockReturnValue(exec([])),
    aggregate: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

async function build(user: any, models: { [name: string]: any } = {}) {
  const names = ['prod_orders', 'purchase_orders', 'subcontractors', 'stockkeepings', 'fat_project', 'fat_checklist', 'training_register', 'users'];
  const module = await Test.createTestingModule({
    providers: [
      DashboardService,
      { provide: REQUEST, useValue: { user } },
      ...names.map(n => ({ provide: getModelToken(n), useValue: models[n] || modelMock() })),
    ],
  }).compile();
  // REQUEST is a plain value here, so the service is a normal singleton in this module.
  return module.get(DashboardService);
}

describe('DashboardService', () => {
  const restrictedUser = { roles: ['OPERATOR'], areas: ['warehouse', 'fat'], company: 'acme', location: [{ code: 'SUB-NW-01|SUB-NW-02', name: 'Partner C' }] };
  const adminUser = { roles: ['ADMIN'], company: 'tenant-a', location: [{ code: 'WH-SYD-A1', name: 'Meridian HQ' }] };

  it('omits training for non-admins and never queries it', async () => {
    const training = modelMock();
    const users = modelMock();
    const service = await build(restrictedUser, { training_register: training, users });
    const summary = await service.getSummary();
    expect(summary.training).toBeUndefined();
    expect(training.find).not.toHaveBeenCalled();
    expect(users.find).not.toHaveBeenCalled();
  });

  describe('training counts for admins', () => {
    const daysAgo = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return localIsoDate(d);
    };
    const people = (list: any[]) => modelMock({ find: jest.fn().mockReturnValue(exec(list)) });

    it('counts the people with a role and their expired, due-soon and missing modules', async () => {
      // One warehouse module expired (3 years ago), one due soon (23 months ago), the rest of the six never done.
      const users = people([
        { username: 'sam', areas: ['warehouse'] },
        { username: 'jordan', areas: [] },
        { username: 'kim' },
      ]);
      const training = people([{
        user_id: 'sam',
        training_modules: [
          { module: 'Warehouse Safety Induction', date: daysAgo(3 * 365) },
          { module: 'Stock Management', date: daysAgo(23 * 30) },
          { module: 'RMA Register', date: daysAgo(10) },
        ],
      }]);
      const service = await build(adminUser, { users, training_register: training });
      const summary = await service.getSummary();
      expect(summary.training).toEqual({ people: 1, expired: 1, dueSoon: 1, missing: 3 });
    });

    it('reports zeros when nobody holds a role', async () => {
      const service = await build(adminUser, { users: people([{ username: 'a', areas: [] }]) });
      const summary = await service.getSummary();
      expect(summary.training).toEqual({ people: 0, expired: 0, dueSoon: 0, missing: 0 });
    });
  });

  describe('sections by area', () => {
    const only = (areas: string[]) => ({ ...restrictedUser, areas });

    it('gives a warehouse user the warehouse sections and no FAT section', async () => {
      const fat = modelMock();
      const service = await build(only(['warehouse']), { fat_project: fat });
      const summary = await service.getSummary();
      expect(Object.keys(summary).sort()).toEqual(['inventory', 'orders', 'production', 'receiving']);
      expect(fat.find).not.toHaveBeenCalled();
    });

    it('gives a FAT user the FAT section only, and does not query warehouse data', async () => {
      const prod = modelMock();
      const stock = modelMock();
      const service = await build(only(['fat']), { prod_orders: prod, stockkeepings: stock });
      const summary = await service.getSummary();
      expect(Object.keys(summary)).toEqual(['fat']);
      expect(prod.find).not.toHaveBeenCalled();
      expect(stock.countDocuments).not.toHaveBeenCalled();
    });

    it('gives a user with no areas nothing', async () => {
      const service = await build(only([]));
      expect(await service.getSummary()).toEqual({});
    });

    it('gives an admin every section, with or without areas listed', async () => {
      const service = await build({ ...adminUser, areas: undefined });
      const summary = await service.getSummary();
      expect(Object.keys(summary).sort()).toEqual(['fat', 'inventory', 'orders', 'production', 'receiving', 'training']);
    });
  });

  it('scopes production to released parent orders at the user locations', async () => {
    const prod = modelMock();
    const service = await build(restrictedUser, { prod_orders: prod });
    await service.getSummary();
    expect(prod.find.mock.calls[0][0]).toEqual({
      parent_ref: 0, status: 'Released', location: { $in: ['SUB-NW-01|SUB-NW-02'] },
    });
  });

  it('counts open, in-progress and overdue production orders, leaving out completed ones', async () => {
    const prod = modelMock({
      find: jest.fn().mockReturnValue(exec([
        order('Released', 5, [[10, 0, 10]]),   // not started
        order('Released', -2, [[10, 4, 6]]),   // in progress and late
        order('Released', -9, [[10, 10, 0]]),  // completed: not counted even though it is past due
      ])),
    });
    const service = await build(adminUser, { prod_orders: prod });
    const summary = await service.getSummary();
    expect(summary.production).toEqual({ open: 2, inProgress: 1, overdue: 1 });
  });

  it('scopes inventory by the first location code split on |', async () => {
    const stock = modelMock();
    const service = await build(restrictedUser, { stockkeepings: stock });
    await service.getSummary();
    expect(stock.countDocuments.mock.calls[0][0]).toEqual({ location: { $in: ['SUB-NW-01', 'SUB-NW-02'] } });
  });

  it('gives head-office staff every order in Orders, with no subcontractor lookup', async () => {
    const po = modelMock({ aggregate: jest.fn().mockResolvedValue([]) });
    const subcon = modelMock();
    const service = await build(adminUser, { purchase_orders: po, subcontractors: subcon });
    await service.getSummary();
    expect(subcon.find).not.toHaveBeenCalled();
    const pipelines = po.aggregate.mock.calls.map(c => c[0]);
    const orders = pipelines.find(p => !p[0].$match);
    const receiving = pipelines.find(p => p[0].$match);
    expect(orders).toBeDefined(); // Orders: no filter at all
    expect(receiving[0].$match.status).toBe('Released');
    expect(receiving[0].$match.items.$elemMatch.qty_remaining).toEqual({ $gt: 0 });
  });

  it('counts open orders, overdue and due-this-week from the same status rules as the lists', async () => {
    const received = order('Released', -3, [[10, 10, 0]]);
    const overdue = order('Released', -2, [[10, 0, 10]]);
    const draft = order('Open', 20, [[5, 0, 5]]);
    const thisWeek = order('Released', 3, [[10, 4, 6], [5, 0, 5]]);
    const po = modelMock({
      aggregate: jest.fn().mockImplementation(async (pipeline: any[]) =>
        pipeline[0].$match ? [overdue, thisWeek] : [received, overdue, draft, thisWeek]),
    });
    const service = await build(adminUser, { purchase_orders: po });
    const summary = await service.getSummary();
    // Orders: everything not fully received.
    expect(summary.orders).toEqual({ open: 3, openLines: 4, overdue: 1, dueThisWeek: 1 });
    // Receiving: released orders with lines still to receive.
    expect(summary.receiving).toEqual({ open: 2, openLines: 3, overdue: 1, dueThisWeek: 1 });
  });

  it('splits receiving and orders by the user subcontractor vendors for everyone outside head office', async () => {
    const po = modelMock({ aggregate: jest.fn().mockResolvedValue([]) });
    const subcon = modelMock({ find: jest.fn().mockReturnValue(exec([{ vendor: [{ vendor_no: 'V1' }] }])) });
    const service = await build(restrictedUser, { purchase_orders: po, subcontractors: subcon });
    await service.getSummary();
    const filters = po.aggregate.mock.calls.map(c => c[0][0].$match.vendor_no);
    expect(filters).toContainEqual({ $nin: ['V1'] }); // receiving
    expect(filters).toContainEqual({ $in: ['V1'] }); // orders
  });

  it('de-duplicates FAT projects returned once per checker group', async () => {
    const fat = modelMock({
      aggregate: jest.fn().mockResolvedValue([
        { project: 'P1', progress: 100 },
        { project: 'P1', progress: 100 },
        { project: 'P2', progress: 40 },
        { project: 'P3', progress: 0 },
      ]),
    });
    const service = await build(restrictedUser, { fat_project: fat });
    const summary = await service.getSummary();
    expect(summary.fat).toEqual({ total: 3, inProgress: 1, complete: 1, attention: { units: 0, failedChecks: 0 } });
  });

  it('counts the units with failed checks, and how many checks failed', async () => {
    const units = modelMock({
      find: jest.fn().mockReturnValue(exec([
        { category: [{ name: 'A', checklists: [{ description: 'x', status: 'Incomplete' }, { description: 'y', status: 'Complete' }] }] },
        { category: [{ name: 'A', checklists: [{ description: 'x', status: 'Incomplete' }] }, { name: 'B', checklists: [{ description: 'z', status: 'Incomplete' }] }] },
        // Unanswered checks are not failures, and neither is a heading.
        { category: [{ name: 'A', checklists: [{ description: 'h', reference: 'Heading', status: 'Incomplete' }, { description: 'x', status: null }] }] },
        { category: [] },
      ])),
    });
    const service = await build(adminUser, { fat_checklist: units });
    const summary = await service.getSummary();
    expect(summary.fat.attention).toEqual({ units: 2, failedChecks: 3 });
    expect(units.find.mock.calls[0][0]).toEqual({});
  });

  it('only counts the units a checking company is responsible for', async () => {
    const units = modelMock();
    const service = await build(restrictedUser, { fat_checklist: units });
    await service.getSummary();
    expect(units.find.mock.calls[0][0]).toEqual({ checker: 'acme' });
  });
});
