export interface TrainingModule {
    module: string;
    // YYYY-MM-DD, the day the module was completed. Renewal is worked out from it (see training-status.ts).
    date: string;
}