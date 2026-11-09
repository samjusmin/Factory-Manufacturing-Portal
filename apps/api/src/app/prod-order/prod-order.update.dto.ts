export class ProdOrderUpdateDTO {
    readonly type: string;
    readonly id: string;
    readonly doc_no: string;
    readonly parent_ref: number;
    readonly line: number;
    readonly item_no: string;
    readonly variant: string;
    readonly project: string;
    readonly location: string;
    readonly qty: number;
}