import { ShippingDetail } from './shipping-detail';
import { POItemList } from './item-list';
import { IPOSummary } from './purchase-order-status';

export interface IPurchaseOrder {
  key: string;
  doc_no: string;
  vendor: string;
  vendor_no?: string;
  location: string;
  project: string;
  status: string;
  cost_centre: string;
  expected_due_date: string;
  shipping_ref: string;
  ship_to: Array<ShippingDetail>;
  items: Array<POItemList>;
  // Added by the API: status, progress and due-date bucket (see summarisePurchaseOrder).
  summary?: IPOSummary;
}