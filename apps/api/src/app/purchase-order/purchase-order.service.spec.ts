import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { PurchaseOrderService } from './purchase-order.service';

const exec = (value: any) => ({ exec: () => Promise.resolve(value) });

const hqUser = { username: 'admin', roles: ['ADMIN'], location: [{ code: 'WH-SYD-A1', name: 'Meridian HQ' }] };
const siteUser = { username: 'sam', roles: ['OPERATOR'], location: [{ code: 'SUB-NW-01', name: 'Northwind Partners' }] };

// Orders that make each status and bucket easy to see.
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};
const docs = [
  { doc_no: 'PO-1', status: 'Released', expected_due_date: day(-2), items: [{ qty: 10, qty_received: 0, qty_remaining: 10 }] },
  { doc_no: 'PO-2', status: 'Released', expected_due_date: day(3), items: [{ qty: 10, qty_received: 10, qty_remaining: 0 }] },
];

async function build(user: any, orders: any[] = docs, vendors: string[] = []) {
  const purchaseOrders = { aggregate: jest.fn().mockResolvedValue(orders) };
  const subcontractors = { find: jest.fn().mockReturnValue(exec(vendors.length ? [{ vendor: vendors.map(v => ({ vendor_no: v })) }] : [])) };
  const module = await Test.createTestingModule({
    providers: [
      PurchaseOrderService,
      { provide: REQUEST, useValue: { user } },
      { provide: WINSTON_MODULE_PROVIDER, useValue: { info: jest.fn(), error: jest.fn() } },
      { provide: getModelToken('purchase_orders'), useValue: purchaseOrders },
      { provide: getModelToken('subcontractors'), useValue: subcontractors },
    ],
  }).compile();
  return { service: module.get(PurchaseOrderService), purchaseOrders, subcontractors };
}

describe('PurchaseOrderService', () => {
  it('Receiving (findAll) asks only for released orders with open lines at the user locations, earliest due first', async () => {
    const { service, purchaseOrders } = await build(hqUser);
    await service.findAll();
    const pipeline = purchaseOrders.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match.status).toBe('Released');
    expect(pipeline[0].$match.items.$elemMatch).toEqual({ location: { $in: ['WH-SYD-A1'] }, qty_remaining: { $gt: 0 } });
    expect(pipeline[pipeline.length - 1]).toEqual({ $sort: { expected_due_date: 1, doc_no: 1 } });
  });

  it('Orders (findOrders) applies no filter at all for head office', async () => {
    const { service, purchaseOrders } = await build(hqUser);
    await service.findOrders();
    const pipeline = purchaseOrders.aggregate.mock.calls[0][0];
    expect(pipeline.find(stage => stage.$match)).toBeUndefined();
  });

  it('keeps the subcontractor vendor split outside head office: Receiving excludes, Orders includes', async () => {
    const receiving = await build(siteUser, docs, ['V2001']);
    await receiving.service.findAll();
    expect(receiving.purchaseOrders.aggregate.mock.calls[0][0][0].$match.vendor_no).toEqual({ $nin: ['V2001'] });

    const orders = await build(siteUser, docs, ['V2001']);
    await orders.service.findOrders();
    const match = orders.purchaseOrders.aggregate.mock.calls[0][0][0].$match;
    expect(match.vendor_no).toEqual({ $in: ['V2001'] });
    expect(match.status).toBe('Released');
  });

  it('attaches each order status summary to what it returns', async () => {
    const { service } = await build(hqUser);
    const result: any[] = await service.findOrders();
    expect(result.map(po => po.summary.state)).toEqual(['On order', 'Received']);
    expect(result[0].summary.bucket).toBe('overdue');
    expect(result[0].summary.days_late).toBe(2);
  });

  it('shows head office every line of an order in the read-only order view, but not in the receiving view', async () => {
    const order = await build(hqUser);
    await order.service.findPOForOrders('PO-1');
    expect(JSON.stringify(order.purchaseOrders.aggregate.mock.calls[0][0])).not.toContain('$filter');

    const receiving = await build(hqUser);
    await receiving.service.findPO('PO-1');
    expect(JSON.stringify(receiving.purchaseOrders.aggregate.mock.calls[0][0])).toContain('$filter');
  });

  it('only shows lines at the user own locations in the order view for everyone else', async () => {
    const { service, purchaseOrders } = await build(siteUser);
    await service.findPOForOrders('PO-1');
    expect(JSON.stringify(purchaseOrders.aggregate.mock.calls[0][0])).toContain('$filter');
  });
});
