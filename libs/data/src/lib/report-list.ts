export interface ReportList {
    date: string;
    item_no: string;
    revision?: null | string;
    description: string;
    project: string;
    doc_no: string;
    qty_issue: number;
    issue_type: string;
    status: string;
    shp_ref: string;
}