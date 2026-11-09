export interface IFactoryTest {
    doc_no: string;
    project: string;
    phase: string;
    location: string;
    unit_type: string;
    variant: string;
    checker: string;
    opt_honeywell: number;
    opt_printer: number;
    options: Array<string>;
    category: Array<FATcategory>;
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

export class FATserialNum {
    doc_no: string;
    unit_no: string;
    project: string;
    phase: string;
    progress: number;
}

export interface CheckList {
    description: string;
    value: string;
    serial_no: null | string;
    firmware_ver: null | string;
}

export interface Options {
    bio: boolean;
    desko: boolean;
    nfc: boolean;
    magnetic: boolean;
    opt_access: boolean,
}

export interface FATEntry {
    location: string,
    prefix: string,
    start: number,
    number: number, 
    checker: string, 
    unit_type: string, 
    printers: number,
    honeywell: number, 
    options: Array<string>
}

export interface IFATPhase {
    id: string,
    phase: string,
    checkers: string,
    progress: number,
    // What the API returns for each phase, beyond the fields above.
    name?: string,
    numOfUnits?: number,
};
  
export interface FATUnit {
    unit: string,
    location: string,
    progress: number,
    // What the API returns for each unit, beyond the fields above.
    doc_no?: string,
    unit_no?: string,
    unit_type?: string,
};


export interface IFATProject {
    project: string,
    progress: number,
};

export interface FATtype {
    _id: string
};

export interface FATunitType {
    doc_no: string,
    unit_no: string,
};

export interface FATAddChecklist {
    units: Array<FATunitType>,
    categories: Array<FATcategory>
};

export interface FAToptions {
    name: string,
    value: string,
};

export interface FATUnitComments {
    unit: string,
    comment: string,
    // What the API returns for each unit's notes.
    doc_no?: string,
    unit_no?: string
}