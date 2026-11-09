import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProdOrderService } from './prod-order.service';

const order = (extra: any = {}) => ({
  doc_no: 'MRP-1', parent_ref: 10000, location: 'WH-SYD-A1',
  items: [{ line_no: 10, item_no: 'I', revision: ' ', qty_remaining: 5 }],
  ...extra,
});
const row = (qty: any, extra: any = {}) => ({ type: 'consumption', id: 'x', doc_no: 'MRP-1', parent_ref: 10000, line: 10, item_no: 'I', variant: ' ', project: 'P', location: 'WH-SYD-A1', qty, ...extra });

// What can be posted is decided here, as a request does not have to come from the page.
describe('ProdOrderService quantities', () => {
  let model: any;
  let stock: any;
  let service: ProdOrderService;

  const build = (found: any = order(), inventory: number | null = 100) => {
    stock = {
      findOne: jest.fn().mockResolvedValue(inventory === null ? null : { inventory }),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    model = {
      findOne: jest.fn(() => ({ lean: () => Promise.resolve(found) })),
      bulkWrite: jest.fn().mockResolvedValue({}),
      db: { collection: () => stock },
    };
    const request = { user: { username: 'sam', location: [{ code: 'WH-SYD-A1' }] } };
    service = new ProdOrderService(model, {} as any, request as any, { info: jest.fn(), error: jest.fn() } as any);
  };

  const refused = async (rows: any[], type: any) => {
    await expect(service.updateNAVConsumption(rows as any)).rejects.toBeInstanceOf(type);
    expect(model.bulkWrite).not.toHaveBeenCalled();
    expect(stock.updateOne).not.toHaveBeenCalled();
  };

  beforeEach(() => build());

  it('consumes up to what is left, and takes it out of stock', async () => {
    await expect(service.updateNAVConsumption([row(5)] as any)).resolves.toBe(true);
    expect(stock.updateOne.mock.calls[0][1]).toEqual({ $inc: { inventory: -5 } });
  });

  it('uses the stored item and location for stock, not the ones in the request', async () => {
    await service.updateNAVConsumption([row(1, { item_no: 'OTHER', location: 'ELSEWHERE' })] as any);
    expect(stock.updateOne.mock.calls[0][0]).toEqual({ no: 'I', variant: ' ', location: 'WH-SYD-A1' });
  });

  it('refuses more than is left', () => refused([row(6)], BadRequestException));

  it('counts the same line twice in one request as one amount', () => refused([row(3), row(3)], BadRequestException));

  it('refuses a negative or something that is not a number', async () => {
    await refused([row(-1)], BadRequestException);
    await refused([row('lots')], BadRequestException);
  });

  it('refuses a request with no quantities at all, and leaves out rows with none', async () => {
    await refused([], BadRequestException);
    await refused([row(0), row(null)], BadRequestException);
    await service.updateNAVConsumption([row(0), row(2)] as any);
    expect(stock.updateOne).toHaveBeenCalledTimes(1);
  });

  it('refuses a line that does not exist', () => refused([row(1, { line: 99 })], NotFoundException));

  it('refuses an order at another location', async () => {
    build(order({ location: 'SUB-NW-01' }));
    await refused([row(1)], ForbiddenException);
  });

  it('refuses consuming more than is in stock', async () => {
    build(order(), 2);
    await refused([row(3)], BadRequestException);
  });

  it('allows consumption of an item with no stock record, as there is nothing to compare with', async () => {
    build(order(), null);
    await expect(service.updateNAVConsumption([row(1)] as any)).resolves.toBe(true);
  });

  it('applies the left-to-post limit to output, but not the stock limit', async () => {
    build(order(), 0);
    await expect(service.updateNAVOutput([row(5, { type: 'output' })] as any)).resolves.toBe(true);
    expect(stock.updateOne.mock.calls[0][1]).toEqual({ $inc: { inventory: 5 } });
    build(order(), 0);
    await expect(service.updateNAVOutput([row(6, { type: 'output' })] as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
