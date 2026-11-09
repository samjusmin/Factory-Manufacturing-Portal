import { MRPItemList } from './item-list';
import { IPurchaseOrder } from './purchase-order';
import { IStockkeeping } from './sku';
import { IProdSummary } from './prod-order-status';

export interface IProdOrder {
  _id: string;
  key: string;
  doc_no: string;
  doc_description: string;
  source_no: string;
  description: string;
  project: string;
  status: string;
  location: string;
  cost_centre: string;
  expected_due_date: string;
  qty: number;
  parent_ref: number;
}

export interface MainProdOrder extends IProdOrder{
  items: Array<MRPItemList>;
  // Added by the API: status and progress (see summariseProdOrder).
  summary?: IProdSummary;
  result?: null | Array<IPurchaseOrder>;
}

export interface SubProdOrder extends IProdOrder {
  items: MRPItemList;
  result?: null | Array<IPurchaseOrder>;
  stock?: null | Array<IStockkeeping>;
  parents?: null | Array<any>;
  item_no?: null | string;
  // description?: null | string;
}