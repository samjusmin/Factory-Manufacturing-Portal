import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { STOCK_PROJECT, TRAINING_REQUIREMENTS, checklistProgress } from '@webproject/data';
import { clearTemplateOverrides } from '../factory-acceptance-test/checklist-templates';

const tpl = {
  unitName: require('../factory-acceptance-test/checklist-template/unit-name-checklist.json'),
  kioskCommon: require('../factory-acceptance-test/checklist-template/kiosk-common-checklist.json'),
  unitX1Common: require('../factory-acceptance-test/checklist-template/unit-x1-common-checklist.json'),
  kioskACommon: require('../factory-acceptance-test/checklist-template/kiosk-a-common-checklist.json'),
  bios: require('../factory-acceptance-test/checklist-template/bios-checklist.json'),
  serials: require('../factory-acceptance-test/checklist-template/serial-numbers.json'),
  unitZHardware: require('../factory-acceptance-test/checklist-template/hardware/unit-z-hardware-checklist.json'),
  unitX1Hardware: require('../factory-acceptance-test/checklist-template/hardware/unit-x1-hardware-checklist.json'),
};

// The checklists a hardware type starts from (Config > Item Checklists), keyed by what they are for.
const cfg = {
  kioskA: require('../config-catalogue/checklist-template/kiosk-a-checklist.json'),
  unitX1: require('../config-catalogue/checklist-template/unit-x1-checklist.json'),
  unitX2: require('../config-catalogue/checklist-template/unit-x2-checklist.json'),
  bioPc: require('../config-catalogue/checklist-template/options/bio-pc-checklist.json'),
  moduleBtg: require('../config-catalogue/checklist-template/options/module-btg-checklist.json'),
  biometric: require('../config-catalogue/checklist-template/biometric-checklist.json'),
  unitW1: require('../config-catalogue/checklist-template/unit-w1-checklist.json'),
  switch: require('../config-catalogue/checklist-template/options/switch-checklist.json'),
  handheld: require('../config-catalogue/checklist-template/options/handheld-checklist.json'),
};

const HQ = { code: 'WH-SYD-A1', name: 'Meridian HQ' };
const NW = { code: 'SUB-NW-01', name: 'Northwind Partners' };
const PA = { code: 'SUB-PA-01', name: 'Partner A' };
const PB = { code: 'SUB-PB-01', name: 'Partner B' };
const PC = { code: 'SUB-PC-01', name: 'Partner C' };

const iso = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const oid = () => new Types.ObjectId();

// Copies a checklist template, marking the first `done` items Complete.
function fill(template: any[], done: number, checker: string, serialBase?: string) {
  return template.map((t, i) => ({
    ...t,
    status: i < done ? 'Complete' : null,
    checked_by: i < done ? checker : null,
    second_checker: null,
    comment: serialBase && i < done ? (i === 0 ? serialBase : `${serialBase}-${i + 1}`) : null,
    date_checked: i < done ? iso(-(i % 5)) : null,
  }));
}

function category(name: string, template: any[], done: number, checker: string, serialBase?: string) {
  const checklists = fill(template, Math.min(done, template.length), checker, serialBase);
  const complete = checklists.filter((c) => c.status === 'Complete').length;
  return { name, progress: Math.round((complete / Math.max(checklists.length, 1)) * 100), checklists };
}

const avg = (nums: number[]) => (nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0);

// Demo data for every collection so the app is explorable straight after `npm start`.
// Runs once per process start, only when the database is empty (the in-memory DB resets on restart).
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly log = new Logger('SeedService');

  constructor(@InjectConnection() private readonly connection: Connection) {}

  private col(modelName: string) {
    return this.connection.models[modelName].collection;
  }

  async onApplicationBootstrap() {
    // Checklist edits made through the admin UI live only for the lifetime of the API process.
    clearTemplateOverrides();

    if ((await this.col('users').countDocuments()) > 0) return;

    await this.seedUsers();
    await this.seedStock();
    await this.seedProduction();
    await this.seedPurchasing();
    await this.seedFat();
    await this.seedConfig();
    await this.seedTraining();
    // Optional: SEED_BULK_UNITS=5000 adds that many generated FAT units, to try the app (Deep Search in particular) on a lot of data.
    const bulk = parseInt(process.env.SEED_BULK_UNITS || '0', 10);
    if (bulk > 0) {
      await this.seedBulkUnits(bulk);
    }
    this.log.log('Demo data loaded');
  }

  private async seedUsers() {
    await this.col('users').insertMany([
      // The three demo accounts you can sign in with. `areas` are the parts of the app a person works in (warehouse,
      // config, fat): they decide which pages open and which training is required. Admins can open everything.
      { username: 'admin', name: 'Alex', location: [HQ], web_token: 'demo-token-admin', company: 'tenant-a', roles: ['ADMIN'], areas: ['warehouse', 'config', 'fat'] },
      { username: 'operator', name: 'Sam', location: [HQ], web_token: 'demo-token-operator', company: 'tenant-a', roles: ['OPERATOR'], areas: ['warehouse', 'config', 'fat'] },
      { username: 'partner', name: 'Jordan', location: [NW], web_token: 'demo-token-partner', company: 'partner-a', roles: ['EXTUSER'], areas: ['fat'] },
      // More people, so the Training register has something to show. They cannot sign in (no demo password).
      { username: 'priya', name: 'Priya Nair', location: [HQ], web_token: 'demo-token-priya', company: 'tenant-a', roles: ['OPERATOR'], areas: ['warehouse'] },
      { username: 'marcus', name: 'Marcus Cole', location: [HQ], web_token: 'demo-token-marcus', company: 'tenant-a', roles: ['OPERATOR'], areas: ['warehouse', 'config', 'fat'] },
      { username: 'lena', name: 'Lena Fischer', location: [HQ], web_token: 'demo-token-lena', company: 'tenant-a', roles: ['OPERATOR'], areas: [] },
      { username: 'tom', name: 'Tom Okafor', location: [NW], web_token: 'demo-token-tom', company: 'partner-a', roles: ['EXTUSER'], areas: ['fat'] },
      { username: 'chloe', name: 'Chloe Brandt', location: [PA], web_token: 'demo-token-chloe', company: 'partner-a', roles: ['OPERATOR'], areas: ['config'] },
      { username: 'ravi', name: 'Ravi Menon', location: [PA, PB], web_token: 'demo-token-ravi', company: 'partner-a', roles: ['EXTUSER'], areas: ['fat'] },
      { username: 'dana', name: 'Dana Whitfield', location: [PB], web_token: 'demo-token-dana', company: 'partner-a', roles: ['OPERATOR'], areas: ['config'] },
      { username: 'omar', name: 'Omar Haddad', location: [PC], web_token: 'demo-token-omar', company: 'partner-a', roles: ['OPERATOR'], areas: ['warehouse', 'fat'] },
      { username: 'ines', name: 'Ines Duarte', location: [PC], web_token: 'demo-token-ines', company: 'partner-a', roles: ['OPERATOR'], areas: [] },
    ]);
    await this.col('subcontractors').insertMany([
      { name: 'Northwind Partners', location: [{ loc: NW.code }], vendor: [{ vendor_no: 'V2001' }] },
    ]);
  }

  private async seedStock() {
    const rows: [string, string, string, number, number, number, string][] = [
      ['FG-5000', ' ', 'Pulse Unit Z - finished kit', 6, 2, 4, 'Prod. Order'],
      ['FG-5100', ' ', 'Pulse Unit X1 - finished kit', 2, 2, 4, 'Prod. Order'],
      ['SA-3000', ' ', 'Frame sub-assembly', 14, 5, 10, 'Prod. Order'],
      ['SA-3100', ' ', 'Electronics tray sub-assembly', 3, 5, 10, 'Prod. Order'],
      ['PCB-1001', 'A', 'Main controller PCB', 42, 20, 40, 'Purchase'],
      ['PCB-1002', 'B', 'Power distribution PCB', 8, 15, 30, 'Purchase'],
      ['CAB-2040', ' ', 'Ribbon cable 40-way, 300 mm', 120, 50, 100, 'Purchase'],
      ['CAB-2050', ' ', 'Power harness, 12 V', 0, 25, 50, 'Purchase'],
      ['MTR-4100', 'A', 'Stepper motor, NEMA 17', 18, 10, 20, 'Purchase'],
      ['SNS-5200', ' ', 'Optical presence sensor', 55, 20, 40, 'Purchase'],
      ['DSP-6001', ' ', '10.1" touch display', 9, 6, 12, 'Purchase'],
      ['FAS-7001', ' ', 'M4 x 12 screw (box of 100)', 31, 10, 20, 'Purchase'],
      ['ENC-8001', 'A', 'Aluminium enclosure, front', 11, 6, 12, 'Purchase'],
      ['ENC-8002', 'A', 'Aluminium enclosure, rear', 4, 6, 12, 'Purchase'],
      ['PSU-9001', ' ', '24 V power supply, 150 W', 22, 8, 16, 'Purchase'],
      ['LBL-9100', ' ', 'Asset label roll (500)', 7, 3, 6, 'Purchase'],
      // Edge cases: stock exactly at its reorder point (counts as low), a second variant of an
      // existing item, and a pile far above the reorder level (the level bar caps at full).
      ['LBL-9101', ' ', 'Warning label roll (250)', 3, 3, 6, 'Purchase'],
      ['PCB-1001', 'B', 'Main controller PCB (rev B, pilot batch)', 0, 10, 20, 'Purchase'],
      ['FAS-7002', ' ', 'M4 hex nut (box of 100)', 400, 50, 100, 'Purchase'],
      ['SA-3200', ' ', 'Cable loom sub-assembly with strain relief, pre-crimped, 12 V and 24 V runs', 1, 4, 8, 'Prod. Order'],
    ];
    await this.col('stockkeepings').insertMany([
      ...rows.map(([no, variant, description, inventory, reorder_point, reorder_qty, replenishment_system]) => ({
        no, variant, location: HQ.code, description, inventory, reorder_point, reorder_qty, replenishment_system,
      })),
      // No reorder point set: in stock when there is any, out of stock at zero, never "low".
      { no: 'TST-9300', variant: ' ', location: HQ.code, description: 'Test jig adapter (no reorder rule)', inventory: 12, replenishment_system: 'Purchase' },
      { no: 'TST-9301', variant: ' ', location: HQ.code, description: 'Calibration weight set (no reorder rule)', inventory: 0, replenishment_system: 'Purchase' },
    ]);
  }

  private item(line: number, no: string, revision: string, description: string, qty: number, extra: any = {}) {
    return {
      key: `K${line}-${no}`, line_no: line, item_no: no, revision, description,
      project: 'PRJ-ALPHA', location: HQ.code, qty, unit: 'PCS', type: 'Item',
      qty_to_receive: 0, qty_shipped: 0, qty_received: 0, qty_remaining: qty, qty_per: 1, ...extra,
    };
  }

  private async seedProduction() {
    const docs: any[] = [];
    const mrp = (n: number, source: string, desc: string, qty: number, due: number, lines: [string, string, string, number][], comps: Record<number, [string, string, string, number][]>) => {
      const doc_no = `MRP-000${n}`;
      const base = { key: `MK-${doc_no}`, doc_no, doc_description: desc, project: 'PRJ-ALPHA', status: 'Released', location: HQ.code, cost_centre: 'CC-100', expected_due_date: iso(due) };
      docs.push({
        ...base, _id: `${doc_no}-0`, source_no: source, description: desc, qty, parent_ref: 0,
        items: lines.map(([no, rev, d, q], i) => this.item((i + 1) * 10000, no, rev, d, q * qty)),
      });
      Object.entries(comps).forEach(([lineId, list]) => {
        const line = parseInt(lineId, 10);
        docs.push({
          ...base, _id: `${doc_no}-${line}`, source_no: lines[line / 10000 - 1][0], description: lines[line / 10000 - 1][2], qty, parent_ref: line,
          items: list.map(([no, rev, d, perUnit], i) => this.item((i + 1) * 10000, no, rev, d, perUnit * qty, { qty_per: perUnit })),
        });
      });
    };

    mrp(1, 'FG-5000', 'Pulse Unit Z - build 5 units', 5, 14,
      [['FG-5000', ' ', 'Pulse Unit Z - finished kit', 1]],
      { 10000: [['SA-3000', ' ', 'Frame sub-assembly', 1], ['SA-3100', ' ', 'Electronics tray sub-assembly', 1], ['DSP-6001', ' ', '10.1" touch display', 1], ['PSU-9001', ' ', '24 V power supply, 150 W', 1], ['FAS-7001', ' ', 'M4 x 12 screw (box of 100)', 2]] });
    // MRP-0002 is already past its due date and not started, so the Production list has an overdue order to show.
    mrp(2, 'FG-5100', 'Pulse Unit X1 - build 3 units', 3, -2,
      [['FG-5100', ' ', 'Pulse Unit X1 - finished kit', 1]],
      { 10000: [['SA-3000', ' ', 'Frame sub-assembly', 1], ['MTR-4100', 'A', 'Stepper motor, NEMA 17', 2], ['SNS-5200', ' ', 'Optical presence sensor', 2], ['PSU-9001', ' ', '24 V power supply, 150 W', 1]] });
    mrp(3, 'SA-3000', 'Frame sub-assembly - build 10', 10, 10,
      [['SA-3000', ' ', 'Frame sub-assembly', 1]],
      { 10000: [['ENC-8001', 'A', 'Aluminium enclosure, front', 1], ['ENC-8002', 'A', 'Aluminium enclosure, rear', 1], ['FAS-7001', ' ', 'M4 x 12 screw (box of 100)', 4]] });
    mrp(4, 'SA-3100', 'Electronics tray - build 10', 10, 12,
      [['SA-3100', ' ', 'Electronics tray sub-assembly', 1]],
      { 10000: [['PCB-1001', 'A', 'Main controller PCB', 1], ['PCB-1002', 'B', 'Power distribution PCB', 1], ['CAB-2040', ' ', 'Ribbon cable 40-way, 300 mm', 4], ['CAB-2050', ' ', 'Power harness, 12 V', 2]] });
    mrp(5, 'FG-5200', 'Kiosk A refresh - build 8 units', 8, 35,
      [['FG-5200', ' ', 'Kiosk A refresh kit', 1]],
      { 10000: [['SA-3100', ' ', 'Electronics tray sub-assembly', 1], ['LBL-9100', ' ', 'Asset label roll (500)', 1]] });

    // Date edge cases: part-built and late, due today (not yet late), and finished after its due date (not flagged).
    mrp(6, 'FG-5000', 'Pulse Unit Z - rework batch of 6', 6, -6,
      [['FG-5000', ' ', 'Pulse Unit Z - finished kit', 1]],
      { 10000: [['SA-3000', ' ', 'Frame sub-assembly', 1], ['DSP-6001', ' ', '10.1" touch display', 1]] });
    mrp(7, 'SA-3200', 'Cable loom sub-assembly - build 4', 4, 0,
      [['SA-3200', ' ', 'Cable loom sub-assembly with strain relief, pre-crimped, 12 V and 24 V runs', 1]],
      { 10000: [['CAB-2040', ' ', 'Ribbon cable 40-way, 300 mm', 3], ['CAB-2050', ' ', 'Power harness, 12 V', 1]] });
    mrp(8, 'SA-3000', 'Frame sub-assembly - build 6 (late)', 6, -9,
      [['SA-3000', ' ', 'Frame sub-assembly', 1]],
      { 10000: [['ENC-8001', 'A', 'Aluminium enclosure, front', 1], ['FAS-7001', ' ', 'M4 x 12 screw (box of 100)', 2]] });

    // How many units of each order are already finished, so the list shows every status:
    // MRP-0001 is in progress (2 of 5), MRP-0004 and MRP-0008 are completed, MRP-0006 is part built, the rest have not started.
    const finished: { [doc_no: string]: number } = { 'MRP-0001': 2, 'MRP-0004': 10, 'MRP-0006': 4, 'MRP-0008': 6 };
    docs.filter(d => d.parent_ref === 0 && finished[d.doc_no] !== undefined).forEach(d => {
      d.items.forEach(i => {
        i.qty_received = finished[d.doc_no];
        i.qty_remaining = i.qty - finished[d.doc_no];
      });
    });

    await this.col('prod_orders').insertMany(docs);
  }

  private async seedPurchasing() {
    const ship_to = [{ name: 'Meridian Manufacturing', address: '12 Industry Way', address_2: 'Dock 3', post_code: '2020', city: 'Sydney', county: 'NSW', country_code: 'AU' }];
    const po = (n: number, vendor: string, vendor_no: string, status: string, due: number, lines: [string, string, string, number, number][], extra: any = {}) => ({
      key: `PK-PO-24${String(n).padStart(3, '0')}`, doc_no: `PO-24${String(n).padStart(3, '0')}`, vendor, vendor_no, location: HQ.code, status, project: 'PRJ-ALPHA',
      cost_centre: 'CC-100', expected_due_date: iso(due), shipping_ref: '', ship_to,
      items: lines.map(([no, rev, d, qty, received], i) => this.item((i + 1) * 10000, no, rev, d, qty, {
        type: 'purchaseorder', entry_type: 'Purchase', prod_order: ' ', work_centre: ' ',
        expected_due_date: iso(due),
        qty_received: received, qty_remaining: qty - received, qty_to_receive: qty - received, ...extra,
      })),
    });

    await this.col('purchase_orders').insertMany([
      po(1, 'Apex Components', 'V1001', 'Released', 5, [['PCB-1001', 'A', 'Main controller PCB', 60, 20], ['PCB-1002', 'B', 'Power distribution PCB', 30, 0], ['CAB-2050', ' ', 'Power harness, 12 V', 50, 0]]),
      po(2, 'Brightline Electronics', 'V1002', 'Released', 9, [['DSP-6001', ' ', '10.1" touch display', 12, 0], ['SNS-5200', ' ', 'Optical presence sensor', 40, 40]]),
      po(3, 'Summit Fasteners', 'V1003', 'Released', 2, [['FAS-7001', ' ', 'M4 x 12 screw (box of 100)', 20, 5], ['LBL-9100', ' ', 'Asset label roll (500)', 6, 0]]),
      po(4, 'Apex Components', 'V1001', 'Open', 20, [['ENC-8002', 'A', 'Aluminium enclosure, rear', 12, 0]]),
      // Fully received: appears on Orders (as Received) but no longer on the Receiving work list.
      { ...po(6, 'Brightline Electronics', 'V1002', 'Released', -3, [['SNS-5200', ' ', 'Optical presence sensor', 40, 40], ['PSU-9001', ' ', '24 V power supply, 150 W', 16, 16]]), shipping_ref: 'SHP-77001' },
      // Overdue and untouched: sits in the Overdue bucket on Receiving and is flagged on Orders.
      po(7, 'Summit Fasteners', 'V1003', 'Released', -4, [['MTR-4100', 'A', 'Stepper motor, NEMA 17', 20, 0], ['CAB-2040', ' ', 'Ribbon cable 40-way, 300 mm', 100, 0]]),
      // Part received and already late: both the "Partially received" status and the overdue flag at once.
      po(8, 'Apex Components', 'V1001', 'Released', -8, [['PCB-1001', 'A', 'Main controller PCB', 40, 15], ['ENC-8001', 'A', 'Aluminium enclosure, front', 12, 0]]),
      // Due today: shown under "this week", not overdue.
      po(9, 'Brightline Electronics', 'V1002', 'Released', 0, [['DSP-6001', ' ', '10.1" touch display', 6, 0]]),
      // Larger order with every kind of line: untouched, part received, complete.
      po(10, 'Summit Fasteners', 'V1003', 'Released', 14, [
        ['FAS-7001', ' ', 'M4 x 12 screw (box of 100)', 30, 0], ['FAS-7002', ' ', 'M4 hex nut (box of 100)', 30, 30],
        ['LBL-9100', ' ', 'Asset label roll (500)', 10, 4], ['LBL-9101', ' ', 'Warning label roll (250)', 10, 0],
        ['PSU-9001', ' ', '24 V power supply, 150 W', 8, 8],
      ]),
      // Draft order with no due date yet.
      (() => { const draft = po(11, 'Apex Components', 'V1001', 'Open', 30, [['SA-3200', ' ', 'Cable loom sub-assembly with strain relief, pre-crimped, 12 V and 24 V runs', 4, 0]]); draft.expected_due_date = ''; draft.items.forEach(i => i.expected_due_date = ''); return draft; })(),
      // Subcontract operation delivered by the external supplier, linked to MRP-0003
      {
        ...po(5, 'Northwind Partners', 'V2001', 'Released', 7, [['SA-3000', ' ', 'Frame sub-assembly (powder coat)', 5, 0]]),
        items: [this.item(10000, 'SA-3000', ' ', 'Frame sub-assembly (powder coat)', 5, {
          type: 'purchaseorder', entry_type: 'Output', prod_order: 'MRP-0003', work_centre: 'WC-COAT', location: NW.code, qty_to_receive: 5, expected_due_date: iso(7),
        })],
      },
    ]);

    await this.col('report_issues').insertMany([
      { date: new Date(Date.now() - 2 * 864e5), item_no: 'PCB-1001', revision: 'A', description: 'Main controller PCB', project: 'PRJ-ALPHA', doc_no: 'PO-24001', qty_issue: 2, issue_type: 'Faulty', status: 'Open', shp_ref: 'SHP-77120', note: 'Two boards arrived with bent connector pins.' },
      { date: new Date(Date.now() - 3 * 864e5), item_no: 'DSP-6001', revision: ' ', description: '10.1" touch display', project: 'PRJ-ALPHA', doc_no: 'PO-24002', qty_issue: 1, issue_type: 'Faulty', status: 'Open', shp_ref: 'SHP-77055', note: 'Cracked glass on arrival, packaging crushed on one corner. Photos sent to the supplier, replacement requested before the next build starts.' },
      { date: new Date(Date.now() - 1 * 864e5), item_no: 'CAB-2050', revision: ' ', description: 'Power harness, 12 V', project: 'PRJ-ALPHA', doc_no: 'PO-24001', qty_issue: 10, issue_type: 'Shortage', status: 'Open', shp_ref: 'SHP-77120', note: 'Delivery note says 50, received 40.' },
    ]);
  }

  private async seedFat() {
    const unit = (doc_no: string, project: string, phase: string, type: string, checker: string, cats: any[], serial = '', note = '', location = HQ.name) => ({
      doc_no, unit_no: serial, project, phase, prefix: doc_no.replace(/\d+$/, ''), location, checker,
      unit_type: type, variant: '', opt_printer: 0, opt_honeywell: 0, options: [], comment: note,
      category: cats, progress: avg(cats.map((c) => c.progress)),
    });
    const zCats = (done: number, who = 'Alex', sn = '') => [
      category('Unit Name', tpl.unitName, done > 0 ? 2 : 0, who, sn ? 'SN-' + sn : undefined),
      category('Kiosk Common', tpl.kioskCommon, done, who),
      category('Unit Z Hardware', tpl.unitZHardware, done, who),
      category('Serial Numbers', tpl.serials, Math.floor(done / 2), who, sn ? 'SER-' + sn : undefined),
    ];
    const x1Cats = (done: number, who = 'Sam', sn = '') => [
      category('Unit Name', tpl.unitName, done > 0 ? 2 : 0, who, sn ? 'SN-' + sn : undefined),
      category('Unit X1 Common', tpl.unitX1Common, done, who),
      category('Unit X1 Hardware', tpl.unitX1Hardware, done, who),
      category('Bios', tpl.bios, Math.min(done, 6), who),
    ];
    const kaCats = (done: number) => [
      category('Unit Name', tpl.unitName, done > 0 ? 2 : 0, 'Sam'),
      category('KioskA Common', tpl.kioskACommon, done, 'Sam'),
      category('Bios', tpl.bios, Math.min(done, 6), 'Sam'),
    ];

    // Overrides some answers in a category so it shows Incomplete and N/A checks, notes and a second checker.
    const withAnswers = (cat: any, answers: { [row: number]: [string, string?, string?] }, who = 'Alex') => {
      const checklists = cat.checklists.map((r: any, i: number) => answers[i]
        ? { ...r, status: answers[i][0], comment: answers[i][1] || r.comment, second_checker: answers[i][2] || null, checked_by: who, date_checked: iso(-(i % 4)) }
        : r);
      const done = checklists.filter((c: any) => c.status === 'Complete' || c.status === 'N/A').length;
      return { ...cat, checklists, progress: Math.round((done / Math.max(checklists.length, 1)) * 100) };
    };

    // Inserts section headings before the given check numbers; headings are not checks, so progress ignores them.
    const withHeadings = (cat: any, headings: { [beforeRow: number]: string }) => {
      const checklists: any[] = [];
      cat.checklists.forEach((r: any, i: number) => {
        if (headings[i]) {
          checklists.push({ description: headings[i], reference: 'Heading', status: null, checked_by: null, second_checker: null, comment: null, date_checked: null });
        }
        checklists.push(r);
      });
      return { ...cat, checklists };
    };

    const p1a = oid().toString(), p1b = oid().toString(), p2a = oid().toString();
    const p1c = oid().toString(), p3a = oid().toString(), p4a = oid().toString();
    const A1 = 'PRJ-ALPHA', B1 = 'PRJ-BRAVO', C1 = 'PRJ-CHARLIE', D1 = 'PRJ-DELTA', E1 = 'PRJ-ECHO';
    // A unit whose checks are grouped under section headings, with one failed check in its hardware list.
    const sectioned = x1Cats(8);
    sectioned[1] = withHeadings(sectioned[1], { 0: 'Mechanical', 8: 'Software' });
    sectioned[2] = withAnswers(sectioned[2], { 3: ['Incomplete', 'Mounting bracket cracked, replacement ordered'] }, 'Sam');
    const mixedZ = zCats(9);
    mixedZ[1] = withAnswers(mixedZ[1], { 2: ['Incomplete', 'Latch sticks, rework raised'], 5: ['Incomplete', 'Label misaligned', 'Jordan'], 7: ['N/A', 'No printer fitted on this build'] });
    mixedZ[2] = withAnswers(mixedZ[2], { 4: ['Incomplete', 'Display flickers at low brightness'] });

    const units = [
      unit('UZ1001', A1, p1a, 'unit-z', 'tenant-a', zCats(20, 'Alex', 'Z-84021'), 'SN-Z-84021'),
      unit('UZ1002', A1, p1a, 'unit-z', 'tenant-a', zCats(12, 'Alex', 'Z-84022'), 'SN-Z-84022', 'Rear panel gap re-checked after adjustment; passes.'),
      unit('UZ1003', A1, p1a, 'unit-z', 'tenant-a', zCats(5), '', 'Waiting on a replacement display; retest booked for next week.'),
      unit('UZ1004', A1, p1a, 'unit-z', 'tenant-a', zCats(0)),
      // Failed (Incomplete) and N/A checks, with notes and a second checker.
      unit('UZ1005', A1, p1a, 'unit-z', 'tenant-a', mixedZ, '', 'Two failed checks open; display supplier contacted.'),
      unit('UX2001', A1, p1b, 'unit-x1', 'tenant-a', x1Cats(20, 'Sam', 'X-31007'), 'SN-X-31007'),
      unit('UX2002', A1, p1b, 'unit-x1', 'tenant-a', sectioned),
      unit('UX2003', A1, p1b, 'unit-x1', 'partner-a', x1Cats(6, 'Jordan'), '', '', NW.name),
      unit('KA3001', B1, p2a, 'unit-v2', 'tenant-a', kaCats(10), '', '', 'Meridian HQ - Annex'),
      unit('KA3002', B1, p2a, 'unit-v2', 'tenant-a', kaCats(0), '', '', 'Meridian HQ - Annex'),
      // PRJ-CHARLIE is finished: every check Complete or N/A.
      unit('UZ4001', C1, p3a, 'unit-z', 'tenant-a', zCats(30, 'Alex', 'Z-90011'), 'SN-Z-90011', '', NW.name),
      unit('UZ4002', C1, p3a, 'unit-z', 'tenant-a', [
        zCats(30, 'Sam', 'Z-90012')[0],
        withAnswers(zCats(30, 'Sam')[1], { 6: ['N/A', 'Not applicable to the pilot build'] }, 'Sam'),
        zCats(30, 'Sam')[2],
        zCats(30, 'Sam', 'Z-90012')[3],
      ], 'SN-Z-90012', 'Signed off by the customer on site.', NW.name),
      // PRJ-DELTA has not started: two units, nothing checked.
      unit('KA5001', D1, p4a, 'unit-v2', 'tenant-a', kaCats(0), '', '', 'Meridian HQ - Annex'),
      unit('KA5002', D1, p4a, 'unit-v2', 'tenant-a', kaCats(0)),
    ];
    await this.col('fat_checklist').insertMany(units);

    const phaseProgress = (id: string) => avg(units.filter((u) => u.phase === id).map((u) => u.progress));
    const phase = (id: string, name: string, prefix: string, checkers: string[]) => ({
      id, name, prefix, checkers, progress: phaseProgress(id), numOfUnits: units.filter((u) => u.phase === id).length,
    });
    const phases1 = [phase(p1a, 'Phase 1 - Unit Z build', 'UZ', ['tenant-a']), phase(p1b, 'Phase 2 - Unit X1 build', 'UX', ['tenant-a', 'partner-a'])];
    // A planned phase with no units yet shows the empty-phase state.
    phases1.push(phase(p1c, 'Phase 3 - Spares (planned)', 'UZ', ['tenant-a']));
    const phases2 = [phase(p2a, 'Phase 1 - Kiosk A refresh', 'KA', ['tenant-a'])];
    const phases3 = [phase(p3a, 'Phase 1 - Pilot units', 'UZ', ['tenant-a'])];
    const phases4 = [phase(p4a, 'Phase 1 - Kiosk A pilot', 'KA', ['tenant-a'])];

    await this.col('fat_project').insertMany([
      { project: A1, description: 'Pulse Unit Z and X1 acceptance - batch 1', location: null, progress: avg(phases1.map((p) => p.progress)), phase: phases1, checker_group: ['tenant-a', 'partner-a'] },
      { project: B1, description: 'Kiosk A refresh programme', location: null, progress: avg(phases2.map((p) => p.progress)), phase: phases2, checker_group: ['tenant-a'] },
      { project: C1, description: 'Pulse Unit Z customer pilot', location: null, progress: avg(phases3.map((p) => p.progress)), phase: phases3, checker_group: ['tenant-a'] },
      { project: D1, description: 'Kiosk A pilot, scheduled for next quarter', location: null, progress: avg(phases4.map((p) => p.progress)), phase: phases4, checker_group: ['tenant-a'] },
      // A project with no phases yet shows the empty-project state; the long description tests wrapping.
      { project: E1, description: 'Pulse Unit X2 regional rollout, acceptance plan still being agreed with the customer and the installation partners', location: null, progress: 0, phase: [], checker_group: ['tenant-a'] },
    ]);
  }

  // Generated FAT units for load testing: one project with a phase for every 250 units, spread over several machine
  // types and locations. Each unit has a unit name and a full list of serial numbers, like a real one.
  private async seedBulkUnits(count: number) {
    const types = ['unit-z', 'unit-x1', 'unit-v2'];
    const sites = [HQ.name, NW.name, 'Meridian HQ - Annex', 'Meridian HQ - Dock 2'];
    const phaseCount = Math.ceil(count / 250);
    const phases = Array.from({ length: phaseCount }, (_, i) => ({ id: oid().toString(), name: 'Bulk phase ' + (i + 1), prefix: 'BK', checkers: ['tenant-a'], progress: 0, numOfUnits: 0 }));

    let batch: any[] = [];
    for (let n = 0; n < count; n++) {
      const phase = phases[Math.floor(n / 250)];
      phase.numOfUnits++;
      const done = n % 29;
      const serial = 'BK-' + (100000 + n);
      const cats = [
        category('Unit Name', tpl.unitName, 2, 'Alex', serial),
        category('Serial Numbers', tpl.serials, Math.min(done, tpl.serials.length), 'Alex', 'SER-' + (100000 + n)),
      ];
      batch.push({
        doc_no: 'BK' + (100000 + n), unit_no: serial, project: 'PRJ-BULK', phase: phase.id, prefix: 'BK', location: sites[n % sites.length], checker: 'tenant-a',
        unit_type: types[n % types.length], variant: '', opt_printer: 0, opt_honeywell: 0, options: [], comment: '',
        category: cats, progress: avg(cats.map(c => c.progress)),
      });
      if (batch.length === 500) {
        await this.col('fat_checklist').insertMany(batch);
        batch = [];
      }
    }
    if (batch.length) {
      await this.col('fat_checklist').insertMany(batch);
    }
    await this.col('fat_project').insertOne({ project: 'PRJ-BULK', description: 'Generated units for load testing', location: null, progress: 0, phase: phases, checker_group: ['tenant-a'] });
    this.log.log('Added ' + count + ' generated FAT units');
  }

  private async seedConfig() {
    const imageNames: [string, string, string][] = [
      ['KioskA_Dell7000_Win10_v3', 'Kiosk A PC', 'Standard Windows 10 build for Kiosk A units'],
      ['KioskA_Dell7080_Win11_v1', 'Kiosk A PC', 'Windows 11 build, Dell 7080 hardware'],
      ['UnitX1_Dell7070_Win10_v2', 'Unit X1 PC', 'Unit X1 controller image'],
      ['UnitX1_Dell7000_Win11_v1', 'Unit X1 PC', 'Unit X1 controller image, Windows 11'],
      ['UnitX2_Dell7070_Win10_v4', 'Unit X2 PC', 'Unit X2 scanner PC image'],
      ['Bio_Optiplex9020_Win10_v1', 'Bio PC', 'Biometric PC image'],
      ['ModuleBTG_Dell7000_Win10_v2', 'Module BTG PC', 'Bag-tag camera PC image'],
    ];
    const images = imageNames.map(([name, pc_type, description], i) => ({
      _id: oid(), id: String(i + 1), name, description, pc_type,
      date_created: iso(-30 - i * 12), added_by: 'admin', responsible_person: 'Alex',
    }));
    await this.col('pc_image').insertMany(images);
    const imageIds = images.map((i) => i._id.toString());

    // The hardware catalogue (Config > Item Checklists): categories, the types in each and each type's checklist.
    // A type with no checklist file starts empty, ready for an admin to write one.
    const none: any[] = [];
    const generic = cfg.switch;
    await this.col('config_category').insertMany([
      { name: 'PC', icon: 'desktop', uses_image: true, parts: [] },
      { name: 'UNIT-W1', icon: 'cubes', uses_image: false, parts: ['Unit W1-1', 'Unit W1-2', 'Unit W1-3', 'Unit W1-4'] },
      { name: 'Network Switch', icon: 'cogs', uses_image: false, parts: [] },
      { name: 'Printer', icon: 'file-invoice', uses_image: false, parts: [] },
      { name: 'Realsenses', icon: 'search', uses_image: false, parts: [] },
      { name: 'Light Grids', icon: 'tools', uses_image: false, parts: ['Grid 2'] },
      { name: 'Other', icon: 'box-open', uses_image: false, parts: [] },
    ]);
    const types: [string, string, any[]][] = [
      ['PC', 'Kiosk A PC', cfg.kioskA], ['PC', 'Bio PC', cfg.bioPc], ['PC', 'Unit X2 PC', cfg.unitX2],
      ['PC', 'Module BTG PC', cfg.moduleBtg], ['PC', 'Biometric', cfg.biometric], ['PC', 'Kiosk B PC', none],
      ['PC', 'Unit X1 PC', cfg.unitX1], ['PC', 'Unit V1 PC', none], ['PC', 'Unit V2 PC', none], ['PC', 'Unit V3 PC', none],
      ['UNIT-W1', 'UNIT-W1 Set', cfg.unitW1],
      ['Network Switch', '5-port D-Link', cfg.switch], ['Network Switch', '20-port D-Link', cfg.switch],
      ...['Printer-W', 'Printer-X', 'Printer-Y', 'Printer-Z'].map((t): [string, string, any[]] => ['Printer', t, generic]),
      ['Realsenses', 'Realsense - D415', generic], ['Realsenses', 'Realsense - D435', generic],
      ['Light Grids', 'Light Grid - X', generic], ['Light Grids', 'Light Grid - Y', generic],
      ['Other', 'Handheld Scanner', cfg.handheld],
    ];
    await this.col('config_type').insertMany(types.map(([category, name, checklist]) => ({
      category, name,
      checklist: checklist.map((row) => ({
        description: row.description, reference: row.reference || null, status: null, checked_by: null, date_checked: null, comment: null,
      })),
    })));

    // Hardware models (Config > Hardware List): what a location can pick for a unit's model. Some categories have
    // several (the user chooses), some only one (it is filled in for them).
    const hardwareModels = [
      { _id: oid().toString(), name: 'Dell 7000', config_type: ['PC'] },
      { _id: oid().toString(), name: 'Dell 7070', config_type: ['PC'] },
      { _id: oid().toString(), name: 'Dell 7080', config_type: ['PC'] },
      { _id: oid().toString(), name: 'Laptop', config_type: ['PC'] },
      { _id: oid().toString(), name: 'DGS-1005', config_type: ['Network Switch'] },
      { _id: oid().toString(), name: 'DGS-1210-20', config_type: ['Network Switch'] },
      { _id: oid().toString(), name: 'W1 Controller', config_type: ['UNIT-W1'] },
      { _id: oid().toString(), name: 'LG-100', config_type: ['Light Grids'] },
      { _id: oid().toString(), name: 'Handheld Scanner', config_type: ['Other'] },
    ];
    await this.col('hardware_type').insertMany(hardwareModels);
    const hardwareIds = hardwareModels.map((h) => h._id);

    const fullAccess = [
      { hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Unit X1 PC', 'Unit X2 PC'] },
      { hardware_category: 'UNIT-W1', hardware_type: ['UNIT-W1 Set'] },
      { hardware_category: 'Network Switch', hardware_type: ['5-port D-Link', '20-port D-Link'] },
      { hardware_category: 'Light Grids', hardware_type: ['Light Grid - X', 'Light Grid - Y'] },
      { hardware_category: 'Other', hardware_type: ['Handheld Scanner'] },
    ];
    // Every location also has STOCK (for items not allocated to a project); the codes here are the ones an admin made.
    await this.col('config_location').insertMany([
      { location: 'Meridian HQ', item_access: fullAccess, image_access: imageIds, hardware_access: hardwareIds, projects: ['PRJ-ALPHA', 'PRJ-BRAVO'] },
      { location: 'Northwind Partners', item_access: fullAccess.slice(0, 1), image_access: imageIds.slice(0, 3), hardware_access: hardwareIds.slice(0, 2), projects: ['PRJ-ALPHA'] },
      { location: 'Partner A', item_access: [], image_access: [], hardware_access: [], projects: [] },
      { location: 'Partner B', item_access: [], image_access: [], hardware_access: [], projects: [] },
      { location: 'Partner C', item_access: [], image_access: [], hardware_access: [], projects: [] },
    ]);

    // Units: a serial no. identifies each one. progress is the share of its checks that are done.
    const unit = (hardware_category: string, hardware_type: string, serial_no: string, extra: any, template: any[], done: number, who: string) => {
      const checklist = fill(template, Math.round((template.length * done) / 100), who);
      return {
        location: 'Meridian HQ', hardware_category, hardware_type, serial_no, device_name: null, model: null, pc_image: null,
        project: STOCK_PROJECT, parts: [], version: 0, ...extra, checklist, progress: checklistProgress(checklist),
      };
    };
    await this.col('config_hardware').insertMany([
      unit('PC', 'Kiosk A PC', 'DL7000-A1001', { device_name: 'KA-PC-001', model: 'Dell 7000', pc_image: imageNames[0][0], project: 'PRJ-ALPHA' }, cfg.kioskA, 100, 'Alex'),
      unit('PC', 'Kiosk A PC', 'DL7000-A1002', { device_name: 'KA-PC-002', model: 'Dell 7000', pc_image: imageNames[0][0], project: 'PRJ-ALPHA' }, cfg.kioskA, 60, 'Alex'),
      unit('PC', 'Kiosk A PC', 'DL7080-A1003', { device_name: 'KA-PC-003', model: 'Dell 7080', pc_image: imageNames[1][0] }, cfg.kioskA, 0, 'Alex'),
      unit('PC', 'Unit X1 PC', 'DL7070-X1001', { device_name: 'UX1-PC-001', model: 'Dell 7070', pc_image: imageNames[2][0], project: 'PRJ-BRAVO' }, cfg.unitX1, 100, 'Alex'),
      unit('PC', 'Unit X1 PC', 'DL7070-X1002', { device_name: 'UX1-PC-002', model: 'Dell 7070', pc_image: imageNames[2][0] }, cfg.unitX1, 30, 'Alex'),
      unit('Network Switch', '5-port D-Link', 'DLK5-9001', { device_name: 'SW-01', model: 'DGS-1005', project: 'PRJ-ALPHA' }, cfg.switch, 100, 'Sam'),
      unit('Network Switch', '20-port D-Link', 'DLK20-9002', { device_name: 'SW-02', model: 'DGS-1210-20' }, cfg.switch, 40, 'Sam'),
      unit('UNIT-W1', 'UNIT-W1 Set', 'W1-SET-0001', {
        device_name: 'W1-SET-A', model: 'W1 Controller', project: 'PRJ-ALPHA',
        parts: [1, 2, 3, 4].map((n) => ({ name: `Unit W1-${n}`, serial_no: `W1-SN-000${n}` })),
      }, cfg.unitW1, 50, 'Sam'),
      unit('Light Grids', 'Light Grid - X', 'LG-A-7001', { model: 'LG-100', parts: [{ name: 'Grid 2', serial_no: 'LG-B-7001' }] }, generic, 0, 'Sam'),
      unit('Other', 'Handheld Scanner', 'HHS-3001', { device_name: 'HH-01', model: 'Handheld Scanner', project: 'PRJ-BRAVO' }, cfg.handheld, 100, 'Sam'),
    ]);
  }

  // Completion dates are worked out from today, so the register shows the same mix whenever the app is started:
  // a module renews 2 years (730 days) after it was completed and counts as due soon for the last 60 days of that.
  private async seedTraining() {
    const ago = (days: number) => iso(-days);
    const CURRENT = [20, 90, 200, 330, 450, 560];   // well inside the 2 years
    const DUE_SOON = 690;                            // renews in about 40 days
    const EXPIRED = 800;                             // renewed 70 days ago
    const LONG_EXPIRED = 1100;
    const done = (modules: string[], days: number | number[]) =>
      modules.map((module, i) => ({ module, date: ago(Array.isArray(days) ? days[i % days.length] : days) }));
    const W = TRAINING_REQUIREMENTS.warehouse;
    const C = TRAINING_REQUIREMENTS.config;
    const F = TRAINING_REQUIREMENTS.fat;

    await this.col('training_register').insertMany([
      // Admin: every module of every role, all in date.
      { user_id: 'admin', name: 'Alex', training_modules: done([...W, ...C, ...F], CURRENT) },
      // Operator: warehouse in date; config partly done, one due soon, one expired, the rest not started.
      { user_id: 'operator', name: 'Sam', training_modules: [
        ...done(W, CURRENT),
        ...done(C.slice(0, 3), [120, 260, 400]),
        ...done([C[3]], DUE_SOON),
        ...done([C[4]], EXPIRED),
      ] },
      // Partner: three FAT modules in date, the fourth due soon.
      { user_id: 'partner', name: 'Jordan', training_modules: [...done(F.slice(0, 3), [45, 150, 300]), ...done([F[3]], DUE_SOON)] },
      // Everything current.
      { user_id: 'priya', name: 'Priya Nair', training_modules: done(W, [10, 60, 140, 220, 380, 500]) },
      // All three roles, and plenty wrong: a mix of in date, due soon, long expired and never done.
      { user_id: 'marcus', name: 'Marcus Cole', training_modules: [
        ...done(W.slice(0, 3), [30, 80, 200]),
        ...done([W[3]], LONG_EXPIRED),
        ...done(C.slice(0, 2), [100, DUE_SOON]),
        ...done(C.slice(2, 4), EXPIRED),
        ...done(F.slice(0, 2), [60, 340]),
      ] },
      // No role, but has done a module that nothing requires.
      { user_id: 'lena', name: 'Lena Fischer', training_modules: done(['Logistics'], 150) },
      // Tom (FAT) and Ines (no role) have no record at all: a new starter who has done nothing yet.
      // Config, nearly all in date; the last module is due soon.
      { user_id: 'chloe', name: 'Chloe Brandt', training_modules: [...done(C.slice(0, 8), [15, 70, 130, 210, 290, 370, 450, 520]), ...done([C[8]], DUE_SOON)] },
      // Registered at two locations; every FAT module has expired.
      { user_id: 'ravi', name: 'Ravi Menon', training_modules: done(F, [EXPIRED, LONG_EXPIRED, 760, 900]) },
      { user_id: 'dana', name: 'Dana Whitfield', training_modules: done(C, [5, 40, 95, 150, 230, 310, 400, 480, 600]) },
      // Warehouse in date; FAT mostly missing and one expired.
      { user_id: 'omar', name: 'Omar Haddad', training_modules: [...done(W, [25, 75, 125, 175, 225, 275]), ...done([F[0]], EXPIRED)] },
    ]);
  }
}
