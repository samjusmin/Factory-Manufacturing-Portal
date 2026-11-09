import { ObjectId } from "mongoose";

export class HardwareTypeUpdateDTO {
    readonly id: string;
    readonly name: string;
    readonly config_type: Array<string>;
}
