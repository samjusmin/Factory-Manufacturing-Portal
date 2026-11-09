import { ObjectId } from "mongoose";

export class FATProjectDTO {
    readonly _id: ObjectId;
    readonly description: string;
    readonly location: string;
    readonly progress: number;
    readonly project: string;
    readonly checker_group: Array<string>;
    readonly phase: {
        readonly id: string;
        readonly progress: number;
        readonly name: string;
        readonly prefix: string;
        readonly numOfUnits: number;
    }
}