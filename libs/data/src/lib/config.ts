import { IConfigCheck, IConfigUnitPart } from './config-catalogue';

export class ConfigImages {
    name: string;
    date_created: string;
}

// One unit as the unit list and the unit page get it from the API. The list leaves `checklist` out.
export interface ConfigUnit {
    _id?: string;
    location: string;
    hardware_category: string;
    hardware_type: string;
    serial_no: string;
    device_name: string | null;
    model: string | null;
    pc_image: string | null;
    project: string;
    parts: IConfigUnitPart[];
    progress: number;
    version: number;
    checklist?: IConfigCheck[];
}

export class HardwareType {
    name: string;
    config_type: Array<string>;
}

export interface IHardwareType {
    _id: string;
    name: string;
    config_type: Array<string>;
}

export interface SelectOption {
  name: string;
}
