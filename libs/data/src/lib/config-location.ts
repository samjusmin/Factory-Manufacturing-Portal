export interface IConfigLocation {
    location: string;
    item_access: Array<IConfigHardware>;
    image_access?: Array<string>;
    hardware_access?: Array<string>;
    // The project codes an admin created for the location (STOCK is always there and is not listed).
    projects?: Array<string>;
}

export interface IConfigHardware {
    hardware_category: string;
    hardware_type: Array<string>;
}