// Which purchase orders each page shows. Used by the list endpoints and by the dashboard, so the
// numbers on the Home tiles always match the lists they link to.
//
//   Orders    - a tracker. Every purchase order, in any status, including fully received ones.
//   Receiving - the dock work list. Released orders that still have open lines at the user's locations.
//
// Head-office (HQ) warehouse staff see every order in Orders. Everyone else only sees orders for their
// own locations, and the subcontractor split decides which vendors' orders count as "theirs".

export const HQ_WAREHOUSE = 'WH-SYD-A1';

export type PurchaseOrderListMode = 'orders' | 'receiving';

export function isHeadOffice(locCodes: string[]): boolean {
    return locCodes.includes(HQ_WAREHOUSE);
}

export function buildPipeline(mode: PurchaseOrderListMode, locCodes: string[], vendorNumbers: string[], headOffice: boolean): object[] {
    const itemsAtMyLocations = {
        $filter: { input: '$items', as: 'item', cond: { $in: ['$$item.location', locCodes] } }
    };
    const byDueDate = { $sort: { expected_due_date: 1, doc_no: 1 } };

    if (mode === 'orders') {
        if (headOffice) {
            return [byDueDate];
        }
        return [
            { $match: { 'items.location': { $in: locCodes }, vendor_no: { $in: vendorNumbers }, status: 'Released' } },
            { $addFields: { items: itemsAtMyLocations } },
            byDueDate
        ];
    }

    const match: any = {
        status: 'Released',
        items: { $elemMatch: { location: { $in: locCodes }, qty_remaining: { $gt: 0 } } }
    };
    if (!headOffice) {
        match.vendor_no = { $nin: vendorNumbers };
    }
    return [
        { $match: match },
        { $addFields: { items: itemsAtMyLocations } },
        byDueDate
    ];
}
