import { ObjectId } from "mongoose";

export class PcImageUpdateDTO {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly date_created: string;
    readonly added_by: string;
    readonly responsible_person: string;
    readonly pc_type: string;
}
