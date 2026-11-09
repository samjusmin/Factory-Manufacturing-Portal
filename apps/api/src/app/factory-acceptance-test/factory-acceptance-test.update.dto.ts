import { ObjectId } from "mongoose";

export class newFATDTO {
    doc_no: string;
    unit_no: string;
    project: string;
    phase: string;
    prefix: string;
    location: string;
    unit_type: string;
    variant: string;
    checker: string;
    opt_honeywell: number;
    opt_printer: number;
    options: Array<string>;
    category: Array<FATcategory>;
    comment: string;
    progress: number;
}

export class FATcategory {
    name: string;
    progress: number;
    checklists: Array<FATchecklist>
}

export class FATchecklist {
    description: string;
    reference: string;
    status: string;
    checked_by: string;
    second_checker: string;
    date_checked: string;
    comment: string;
}