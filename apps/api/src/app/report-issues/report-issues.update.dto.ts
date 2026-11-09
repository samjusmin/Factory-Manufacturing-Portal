export class ReportIssuesUpdateDTO {
    readonly item_no: string;
    readonly revision: string;
    readonly description: string;
    readonly project: string;
    readonly doc_no: string;
    qty_issue: number;
    issue_type: string;
    status: string;
    shp_ref: string;
    note: string;
}