import { Model } from 'mongoose';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { IDashboardSummary, summarisePurchaseOrder, summariseProdOrder, summariseFatChecks, summariseTraining, localIsoDate } from '@webproject/data';
import { FATDocument } from '../factory-acceptance-test/factory-acceptance-test.schema';
import { buildPipeline, isHeadOffice, PurchaseOrderListMode } from '../purchase-order/purchase-order.scope';
import { ProdOrderDocument } from '../prod-order/prod-order.schema';
import { PurchaseOrderDocument } from '../purchase-order/purchase-order.schema';
import { SubcontractorDocument } from '../subcontractor/subcontractor.schema';
import { StockkeepingDocument } from '../stockkeeping/stockkeeping.schema';
import { FATProjectDocument } from '../fat-project/fat-project.schema';
import { TrainRegDocument } from '../train-reg/train-reg.schema';
import { UserDocument } from '../user/user.schema';
import { isAdminUser } from '../role/location-scope.guard';
import { userAreas } from '../role/areas.guard';

// Counts only. Each scoping rule below mirrors the list page it summarises, so a tile's
// number matches what the user sees after clicking through. If one of those services
// changes its filter, change the matching method here too.
@Injectable()
export class DashboardService {
    constructor(
        @InjectModel('prod_orders') private ProdOrderModel: Model<ProdOrderDocument>,
        @InjectModel('purchase_orders') private PurchaseOrderModel: Model<PurchaseOrderDocument>,
        @InjectModel('subcontractors') private SubcontractorModel: Model<SubcontractorDocument>,
        @InjectModel('stockkeepings') private StockkeepingModel: Model<StockkeepingDocument>,
        @InjectModel('fat_project') private FATModel: Model<FATProjectDocument>,
        @InjectModel('fat_checklist') private FATUnitModel: Model<FATDocument>,
        @InjectModel('training_register') private TrainRegModel: Model<TrainRegDocument>,
        @InjectModel('users') private UserModel: Model<UserDocument>,
        @Inject(REQUEST) private request: Request,
    ) {}

    async getSummary(): Promise<IDashboardSummary> {
        const user = (this.request as any).user;
        const locCodes: string[] = (user['location'] || []).map(l => l.code);

        // A section is only worked out for people who hold that area (admins hold them all), the same rule that
        // guards the pages behind it.
        const admin = isAdminUser(user);
        const held = userAreas(user);
        const warehouse = admin || held.includes('warehouse');
        const fatArea = admin || held.includes('fat');

        const [production, receiving, orders, inventory, fat, training] = await Promise.all([
            warehouse ? this.productionCounts(locCodes) : undefined,
            warehouse ? this.purchaseOrderCounts(locCodes, 'receiving') : undefined,
            warehouse ? this.purchaseOrderCounts(locCodes, 'orders') : undefined,
            warehouse ? this.inventoryCounts(user['location'] || []) : undefined,
            fatArea ? this.fatCounts(user['company']) : undefined,
            admin ? this.trainingCounts() : undefined,
        ]);

        const summary: IDashboardSummary = {};
        if (warehouse) {
            Object.assign(summary, { production, receiving, orders, inventory });
        }
        if (fat) {
            summary.fat = fat;
        }
        if (training) {
            summary.training = training;
        }
        return summary;
    }

    // Mirrors ProdOrderService.findAll: released top-level orders at the user's locations.
    private async productionCounts(locCodes: string[]) {
        const base = { parent_ref: 0, status: 'Released', location: { $in: locCodes } };
        const orders = await this.ProdOrderModel.find(base).lean().exec();
        const open = (orders as any[]).map(o => summariseProdOrder(o)).filter(s => s.state !== 'Completed');
        return {
            open: open.length,
            inProgress: open.filter(s => s.state === 'In progress').length,
            overdue: open.filter(s => s.overdue).length,
        };
    }

    // Uses the same pipelines and status rules as the Receiving and Orders lists (see purchase-order.scope.ts),
    // so a tile's numbers match what the user sees after clicking through.
    // Orders counts every order that is not fully received; Receiving counts released orders with lines still to receive.
    private async purchaseOrderCounts(locCodes: string[], mode: PurchaseOrderListMode) {
        const headOffice = isHeadOffice(locCodes);
        const vendorNumbers: string[] = [];
        if (!headOffice) {
            const subcons = await this.SubcontractorModel.find({ 'location.loc': { $in: locCodes } }).exec();
            subcons.forEach(s => s.vendor.forEach(v => vendorNumbers.push(v.vendor_no)));
        }
        const docs = await this.PurchaseOrderModel.aggregate(buildPipeline(mode, locCodes, vendorNumbers, headOffice));
        const summaries = docs.map(po => summarisePurchaseOrder(po));
        const open = mode === 'orders' ? summaries.filter(s => s.state !== 'Received') : summaries;
        return {
            open: open.length,
            openLines: open.reduce((sum, s) => sum + s.open_lines, 0),
            overdue: open.filter(s => s.overdue).length,
            dueThisWeek: open.filter(s => s.bucket === 'this-week').length,
        };
    }

    // Mirrors StockkeepingService.findAll, which scopes by the first location's code only
    // (split on '|') and always applies the filter.
    private async inventoryCounts(locations: { code: string }[]) {
        const locExp = locations.length ? locations[0].code.split(/(?:\|)+/) : [];
        const base = { location: { $in: locExp } };
        const [skus, lowStock, outOfStock] = await Promise.all([
            this.StockkeepingModel.countDocuments(base).exec(),
            this.StockkeepingModel.countDocuments({
                ...base,
                reorder_point: { $type: 'number' },
                $expr: { $lte: ['$inventory', '$reorder_point'] },
            }).exec(),
            this.StockkeepingModel.countDocuments({ ...base, inventory: { $lte: 0 } }).exec(),
        ]);
        return { skus, lowStock, outOfStock };
    }

    // Mirrors FatProjectService.findProjects: tenant-a sees all projects, tenant-b one fixed project,
    // other companies the projects listing them in checker_group (one row per match, so
    // de-duplicate on project).
    private async fatCounts(companyRaw: string) {
        const company = (companyRaw || '').toLowerCase();
        let docs: { project: string, progress: number }[];
        if (company === 'tenant-a') {
            docs = await this.FATModel.find({}, { project: 1, progress: 1 }).lean().exec() as any;
        } else if (company === 'tenant-b') {
            docs = await this.FATModel.find({ project: '23TNTB01' }, { project: 1, progress: 1 }).lean().exec() as any;
        } else {
            docs = await this.FATModel.aggregate([
                { $unwind: { path: '$checker_group', preserveNullAndEmptyArrays: false } },
                { $match: { checker_group: company } },
                { $project: { project: 1, progress: 1 } },
            ]);
        }

        const progressByProject = new Map<string, number>();
        docs.forEach(d => progressByProject.set(d.project, d.progress || 0));
        const progresses = Array.from(progressByProject.values());
        const complete = progresses.filter(p => p >= 100).length;
        const inProgress = progresses.filter(p => p > 0 && p < 100).length;
        return { total: progresses.length, inProgress, complete, attention: await this.fatAttention(company) };
    }

    // Mirrors FactoryAcceptanceTestService.findUnits: tenant-a and tenant-b see every unit, other companies only
    // the units they check. "Attention" means at least one check has been marked Incomplete.
    private async fatAttention(company: string) {
        const filter = company === 'tenant-a' || company === 'tenant-b' ? {} : { checker: company };
        const units = await this.FATUnitModel.find(filter, { category: 1 }).lean().exec() as any[];
        let unitsNeedingAttention = 0;
        let failedChecks = 0;
        units.forEach(unit => {
            const failed = summariseFatChecks(unit.category).failed;
            if (failed > 0) {
                unitsNeedingAttention++;
                failedChecks += failed;
            }
        });
        return { units: unitsNeedingAttention, failedChecks };
    }

    // Admin only, like the training register. Counts the required modules across everyone who holds a role, using the
    // same rules as the register so the figures agree with it.
    private async trainingCounts() {
        const today = localIsoDate();
        const [users, records] = await Promise.all([
            this.UserModel.find({}).lean().exec() as Promise<any[]>,
            this.TrainRegModel.find({}).lean().exec() as Promise<any[]>,
        ]);
        const recordOf = new Map<string, any>(records.map(r => [r.user_id, r] as [string, any]));
        const totals = { people: 0, expired: 0, dueSoon: 0, missing: 0 };
        users.forEach(user => {
            const record = recordOf.get(user.username);
            const summary = summariseTraining(user.areas, record ? record.training_modules : [], today);
            if (summary.state === 'none') {
                return;
            }
            totals.people++;
            totals.expired += summary.counts.expired;
            totals.dueSoon += summary.counts.dueSoon;
            totals.missing += summary.counts.missing;
        });
        return totals;
    }
}
