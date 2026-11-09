export interface ItemList {
    key: string;
    line_no: number;
    item_no: string;
    revision?: null | string;
    description: string;
    project: string;
    location: string;
    qty: number;
    unit: string;
    type: string;
    qty_to_receive?: null | number;
    qty_shipped?: null | number;
    qty_received?: null | number;
    qty_remaining?: null | number;
}

export interface POItemList extends ItemList {
    entry_type?: null | string;
    prod_order?: null | string;
    work_centre?: null | string;
}

export interface MRPItemList extends ItemList {
    qty_per?: null | number;
}