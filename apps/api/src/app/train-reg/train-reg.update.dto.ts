// What the training endpoints accept. The values are checked in TrainRegService (the module must be in the catalogue,
// the date must be a real past or present day, and roles must be known areas).
export class CompletionDTO {
    readonly module: string;
    // YYYY-MM-DD
    readonly date: string;
}

export class AreasDTO {
    readonly areas: string[];
}
