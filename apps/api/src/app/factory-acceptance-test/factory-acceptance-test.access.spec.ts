import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FactoryAcceptanceTestService } from './factory-acceptance-test.service';

const nameRows = (comment: string | null, status: string | null = null) => [
  { description: 'Enter Unit Serial No.', reference: null, status, comment, checked_by: null, date_checked: null, second_checker: null },
];

// Who can change a unit, who gets the credit, and what a save does to the shared numbers.
describe('FactoryAcceptanceTestService saves', () => {
  const lean = (value: any) => ({ lean: () => ({ exec: () => Promise.resolve(value) }) });
  const queryResult = (value: any) => Object.assign(Promise.resolve(value), lean(value));
  let model: any;
  let fatProject: any;

  function build(company: string, stored: any[] = nameRows(null), category = 'Unit Name') {
    fatProject = { updateProgress: jest.fn(), updateProjectUnits: jest.fn() };
    model = {
      updateOne: jest.fn().mockResolvedValue({ n: 1, nModified: 1 }),
      // The units this search would find: for a partner, only one they are the checker of.
      find: jest.fn((filter: any) => {
        if (filter.unit_no || filter.doc_no && filter.doc_no.$in) {
          return queryResult([]);
        }
        return queryResult(filter.checker === undefined || filter.checker === 'mine'
          ? [{ category: [{ name: category, version: 1, checklists: stored, progress: 50 }], progress: 50 }]
          : []);
      }),
    };
    const users = { findOne: () => lean({ name: 'Sam' }) };
    return new FactoryAcceptanceTestService(model, { user: { company, username: 'sam' } } as any, {} as any, fatProject, users as any);
  }

  const update = (checklist: any, extra: any = {}) => ({ project: 'P', phase: 'ph', unit: 'U1', category: 'Unit Name', checklist, version: 1, ...extra });

  it('treats a unit a partner cannot see as not found, and writes nothing', async () => {
    const service = build('partner-a');
    await expect(service.updateChecklist(update(nameRows('X')))).rejects.toBeInstanceOf(NotFoundException);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('refuses anything but plain text where a unit is named, as it would go into the database search', async () => {
    const service = build('tenant-a');
    await expect(service.updateChecklist(update(nameRows('X'), { unit: { $ne: null } }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateChecklist(update('nope'))).rejects.toBeInstanceOf(BadRequestException);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('stores the signed-in person as the checker, not the one in the request', async () => {
    const service = build('tenant-a', [{ description: 'A', status: null, comment: null, checked_by: null, date_checked: null }], 'Bios');
    await service.updateChecklist(update([{ description: 'A', status: 'Complete', checked_by: 'FORGED', date_checked: '2001' }], { category: 'Bios' }));
    const saved = model.updateOne.mock.calls[0][1].$set['category.$[element].checklists'];
    expect(saved[0].checked_by).toBe('Sam');
    expect(saved[0].date_checked).not.toBe('2001');
  });

  it('works phase progress out from every unit, not only those the saver can see', async () => {
    const service = build('partner-a');
    model.find.mockReturnValue(Promise.resolve([{ progress: 100 }, { progress: 80 }, { progress: 75 }]));
    expect(Math.round(await service.calculatePhaseProgress('P', 'ph'))).toBe(85);
    expect(model.find.mock.calls[0][0]).toEqual({ project: 'P', phase: 'ph' });
  });

  it('does nothing when asked for the progress of a unit that does not exist', async () => {
    const service = build('tenant-a');
    model.find.mockReturnValue(Promise.resolve([]));
    await expect(service.calculateUnitProgress('P', 'ph', 'NOPE')).resolves.toBeUndefined();
  });

  it('only shows a partner the unit notes of their own units', async () => {
    const service = build('partner-a');
    model.find.mockReturnValue(Promise.resolve([]));
    await service.findPhaseUnitComments('P', 'ph');
    expect(model.find.mock.calls[0][0].checker).toBe('partner-a');
  });

  it('says so when a partner adds a note to a unit they cannot see, and never creates one', async () => {
    const service = build('partner-a');
    model.updateOne.mockResolvedValue({ n: 0, nModified: 0 });
    await expect(service.updateUnitComment({ project: 'P', phase: 'ph', unit: 'U1', comment: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(model.updateOne.mock.calls[0][0].checker).toBe('partner-a');
    expect(model.updateOne.mock.calls[0][2]).toBeUndefined();
  });

  describe('unit names', () => {
    const refusal = async (service: FactoryAcceptanceTestService, checklist: any) => {
      try {
        await service.updateChecklist(update(checklist));
      } catch (error) {
        return error;
      }
      throw new Error('The save should have been refused');
    };

    it('refuses Complete with no name, naming the row, and saves nothing', async () => {
      const service = build('tenant-a');
      const error = await refusal(service, nameRows(null, 'Complete'));
      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getResponse().duplicates).toEqual([{ index: 0, serial: '', reason: 'blank' }]);
      expect(model.updateOne).not.toHaveBeenCalled();
    });

    it('lets a name be taken away while the check is unanswered', async () => {
      const service = build('tenant-a', nameRows('OLD'));
      await service.updateChecklist(update(nameRows('')));
      expect(model.find.mock.calls.some(([filter]) => filter.unit_no !== undefined)).toBe(false);
      expect(model.updateOne.mock.calls[1][1]).toEqual({ $set: { unit_no: '' } });
    });

    it('refuses a name another unit has, naming the row', async () => {
      const service = build('tenant-a');
      const find = model.find.getMockImplementation();
      model.find.mockImplementation((filter: any) => filter.unit_no
        ? Promise.resolve([{ project: 'P', phase: 'ph', doc_no: 'U1' }, { project: 'P', phase: 'ph', doc_no: 'U2' }])
        : find(filter));
      const error = await refusal(service, nameRows('sn-1'));
      expect(error.getResponse().duplicates).toEqual([{ index: 0, serial: 'SN-1', reason: 'existing' }]);
      expect(model.updateOne).not.toHaveBeenCalled();
    });

    it('allows a unit to keep its own name, stored in capitals', async () => {
      const service = build('tenant-a');
      const find = model.find.getMockImplementation();
      model.find.mockImplementation((filter: any) => filter.unit_no ? Promise.resolve([{ project: 'P', phase: 'ph', doc_no: 'U1' }]) : find(filter));
      await service.updateChecklist(update(nameRows('sn-1')));
      expect(model.updateOne.mock.calls[1][1]).toEqual({ $set: { unit_no: 'SN-1' } });
    });
  });

  describe('new unit numbers', () => {
    const entry = { prefix: 'UZ', start: 1001, number: 2 };

    it('refuses a number that already exists', async () => {
      const service = build('tenant-a');
      model.find.mockReturnValue(lean([{ doc_no: 'UZ1002' }]));
      await expect(service.assertNewUnitNumbers([entry])).rejects.toThrow('UZ1002');
      await expect(service.assertNewUnitNumbers([entry])).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses a number the form repeats', async () => {
      const service = build('tenant-a');
      model.find.mockReturnValue(lean([]));
      await expect(service.assertNewUnitNumbers([entry, { prefix: 'UZ', start: 1002, number: 1 }])).rejects.toThrow('UZ1002');
    });

    it('accepts numbers nobody has', async () => {
      const service = build('tenant-a');
      model.find.mockReturnValue(lean([]));
      await expect(service.assertNewUnitNumbers([entry])).resolves.toBeUndefined();
    });
  });
});
