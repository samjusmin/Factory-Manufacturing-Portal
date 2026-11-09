import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrainRegController } from './train-reg.controller';
import { TrainRegSchema } from './train-reg.schema';
import { TrainRegService } from './train-reg.service';
import { UserSchema } from '../user/user.schema';
import { ConfigLocationSchema } from '../config-location/config-location.schema';

@Module({
    imports: [MongooseModule.forFeature([
        { name: 'training_register', schema: TrainRegSchema },
        { name: 'users', schema: UserSchema },
        { name: 'config_location', schema: ConfigLocationSchema },
    ])],
    providers: [TrainRegService],
    controllers: [TrainRegController],
    exports: [TrainRegService]
})
export class TrainRegModule {}
