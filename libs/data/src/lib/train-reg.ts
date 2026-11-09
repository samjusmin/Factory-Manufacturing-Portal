import { TrainingModule } from './train-mod';

export interface ITrainReg {
    user_id: string;
    name: string;
    training_modules: Array<TrainingModule>;
}
