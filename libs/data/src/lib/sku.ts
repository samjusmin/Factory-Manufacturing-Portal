import { IStockSummary } from './stock-status';

export interface IStockkeeping {
    no: string;
    variant?: null | string;
    location: string;
    description: string;
    inventory: number;
    reorder_point?: null | number;
    reorder_qty?: null | number;
    replenishment_system?: null | string;
    // Added by the frontend from summariseStock, for the filter buttons and level bar.
    summary?: IStockSummary;
}