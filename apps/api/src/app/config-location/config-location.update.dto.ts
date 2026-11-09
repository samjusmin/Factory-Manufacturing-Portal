export class ConfigLocationUpdateDTO {
    readonly location: string;
    readonly item_access?: Array<ConfigHardware>;
    readonly image_access?: Array<string>;
    readonly hardware_access?: Array<string>;
    // The project codes an admin created for the location (STOCK is always there and is not listed).
    readonly projects?: Array<string>;
}

export class ConfigHardware {
    readonly hardware_category: string;
    readonly hardware_type: Array<string>;
}
