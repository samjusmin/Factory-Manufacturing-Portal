import { ForbiddenException } from '@nestjs/common';
import { FactoryAcceptanceTestController } from './factory-acceptance-test.controller';

describe('FactoryAcceptanceTestController PATCH', () => {
  const fatService = {
    updateChecklist: jest.fn().mockResolvedValue({ ok: true }),
    updateProgress: jest.fn(),
    removeCategory: jest.fn().mockResolvedValue({ ok: true }),
    editChecklist: jest.fn().mockResolvedValue({ ok: true }),
    updateUnitComment: jest.fn().mockResolvedValue({ ok: true }),
  };
  let controller: FactoryAcceptanceTestController;

  const operator = { user: { roles: ['OPERATOR'] } };
  const admin = { user: { roles: ['ADMIN'] } };
  const element = { project: 'P', phase: 'ph', unit: 'U1', category: 'Cat' };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FactoryAcceptanceTestController(fatService as any, {} as any);
  });

  it('lets any signed-in user tick checks and save unit notes', async () => {
    await controller.editEntry({ type: 'update', element }, operator);
    await controller.editEntry({ type: 'comment', element }, operator);
    expect(fatService.updateChecklist).toHaveBeenCalled();
    expect(fatService.updateUnitComment).toHaveBeenCalled();
  });

  it('refuses to let a non-admin remove a category or edit the global checklist template', async () => {
    await expect(controller.editEntry({ type: 'remove', element }, operator)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.editEntry({ type: 'edit', element }, operator)).rejects.toBeInstanceOf(ForbiddenException);
    expect(fatService.removeCategory).not.toHaveBeenCalled();
    expect(fatService.editChecklist).not.toHaveBeenCalled();
  });

  it('allows an admin to remove a category and edit the template', async () => {
    await controller.editEntry({ type: 'remove', element }, admin);
    await controller.editEntry({ type: 'edit', element }, admin);
    expect(fatService.removeCategory).toHaveBeenCalledWith(element);
    expect(fatService.editChecklist).toHaveBeenCalledWith(element);
  });
});

describe('FactoryAcceptanceTestController GET', () => {
  const fatService = {
    phaseOutstanding: jest.fn().mockResolvedValue([{ doc_no: 'U1', failed: 1 }]),
    unitOutstanding: jest.fn().mockResolvedValue({ failed: 1, items: [] }),
    findCheck: jest.fn().mockResolvedValue([{ checklist: [{ description: 'x' }] }]),
    // Reading a checklist must not write progress, so this must never be called.
    calculateCategoryProgress: jest.fn(),
  };
  let controller: FactoryAcceptanceTestController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FactoryAcceptanceTestController(fatService as any, {} as any);
  });

  it('answers the outstanding checks of a phase and of a unit', async () => {
    expect(await controller.findUnitCat('P', 'ph', 'getOutstanding')).toEqual([{ doc_no: 'U1', failed: 1 }]);
    expect(fatService.phaseOutstanding).toHaveBeenCalledWith('P', 'ph');
    expect(await controller.findUnitCheck('P', 'ph', 'U1', 'getOutstanding')).toEqual({ failed: 1, items: [] });
    expect(fatService.unitOutstanding).toHaveBeenCalledWith('P', 'ph', 'U1');
  });

  it('tells the client which version of the checklist it is reading', async () => {
    fatService.findCheck.mockResolvedValueOnce([{ checklist: [{ description: 'x' }], version: 4 }]);
    const res = { setHeader: jest.fn() };
    await controller.findUnitCheck('P', 'ph', 'U1', 'Cat', res);
    expect(res.setHeader).toHaveBeenCalledWith('X-Checklist-Version', '4');
    // A category with no version yet reads as 0.
    await controller.findUnitCheck('P', 'ph', 'U1', 'Cat', res);
    expect(res.setHeader).toHaveBeenLastCalledWith('X-Checklist-Version', '0');
  });

  it('reads a checklist without changing any progress', async () => {
    expect(await controller.findUnitCheck('P', 'ph', 'U1', 'Cat')).toEqual([{ description: 'x' }]);
    expect(fatService.calculateCategoryProgress).not.toHaveBeenCalled();
  });
});
