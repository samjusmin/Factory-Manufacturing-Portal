export interface IPcImage {
    id: string;
    name: string;
    description: string;
    date_created: string;
    added_by: string;
    responsible_person: string;
    pc_type: string;
}

export interface PcImage {
    _id: string;
    name: string;
    pc_type: string;
}

export interface PcImageNode {
    name: string;
    imageId?: string;
    children?: PcImageNode[];
}