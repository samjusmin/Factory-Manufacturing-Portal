import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PurchaseOrderService } from './purchase-order.service';

const ID = '6aebd4918ba56b937ccba23a';
const order = (extra: any = {}) => ({
  _id: ID, doc_no: 'PO-1', status: 'Released',
  items: [{ line_no: 10, item_no: 'I', revision: ' ', location: 'WH-SYD-A1', qty_remaining: 25 }],
  ...extra,
});
const row = (qty: any, line = 10) => ({ id: ID, ref: 'R', no: 'PO-1', key: 'k', line, line_key: 'lk', qty });

// What can be received is decided here, as a request does not have to come from the page.
describe('PurchaseOrderService receiving', () => {
  let model: any;
  let stock: any;
  let service: PurchaseOrderService;

  const build = (po: any = order()) => {
    stock = { updateOne: jest.fn().mockResolvedValue({}) };
    model = {
      findById: jest.fn(() => ({ lean: () => Promise.resolve(po) })),
      bulkWrite: jest.fn().mockResolvedValue({ nMatched: 1 }),
      db: { collection: () => stock },
    };
    const subcontractors = { find: () => ({ exec: () => Promise.resolve([]) }) };
    const logger = { info: jest.fn(), error: jest.fn() };
    const request = { user: { username: 'sam', location: [{ code: 'WH-SYD-A1' }] } };
    service = new PurchaseOrderService(model, subcontractors as any, request as any, logger as any);
  };

  const refused = async (rows: any[], type: any) => {
    await expect(service.updateNAV(rows as any)).rejects.toBeInstanceOf(type);
    expect(model.bulkWrite).not.toHaveBeenCalled();
    expect(stock.updateOne).not.toHaveBeenCalled();
  };

  beforeEach(() => build());

  it('receives up to what is left, and adds it to stock', async () => {
    await expect(service.updateNAV([row(25)] as any)).resolves.toBe(true);
    expect(model.bulkWrite).toHaveBeenCalledTimes(1);
    expect(stock.updateOne.mock.calls[0][1]).toEqual({ $inc: { inventory: 25 } });
  });

  it('refuses more than is left', () => refused([row(26)], BadRequestException));

  it('counts the same line twice in one request as one amount', () => refused([row(20), row(20)], BadRequestException));

  it('refuses nothing, a negative or something that is not a number', async () => {
    await refused([row(0)], BadRequestException);
    await refused([row(-50)], BadRequestException);
    await refused([row('lots')], BadRequestException);
    await refused([], BadRequestException);
  });

  it('refuses a line that does not exist', () => refused([row(1, 99)], NotFoundException));

  it('refuses an order id that is not valid', () => refused([{ ...row(1), id: { $ne: null } }], NotFoundException));

  it('refuses a line at another location', async () => {
    build(order({ items: [{ line_no: 10, location: 'SUB-NW-01', qty_remaining: 25 }] }));
    await refused([row(1)], ForbiddenException);
  });

  it('refuses an order that is not released', async () => {
    build(order({ status: 'Open' }));
    await refused([row(1)], BadRequestException);
  });

  it('only writes if the line still has enough left, and says so if it no longer does', async () => {
    model.bulkWrite.mockResolvedValue({ nMatched: 0 });
    await expect(service.updateNAV([row(5)] as any)).rejects.toBeInstanceOf(ConflictException);
    expect(model.bulkWrite.mock.calls[0][0][0].updateOne.filter.items.$elemMatch).toEqual({ line_no: 10, qty_remaining: { $gte: 5 } });
    expect(stock.updateOne).not.toHaveBeenCalled();
  });
});
