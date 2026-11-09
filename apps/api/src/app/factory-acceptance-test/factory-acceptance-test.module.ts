import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FactoryAcceptanceTestController } from './factory-acceptance-test.controller';
import { FATSchema } from './factory-acceptance-test.schema';
import { UserSchema } from '../user/user.schema';
import { FactoryAcceptanceTestService } from './factory-acceptance-test.service';
import { FATProject } from '../fat-project/fat-project.schema';
import { FatProjectService } from '../fat-project/fat-project.service';
import { FatProjectModule } from '../fat-project/fat-project.module';

@Module({
    imports: [MongooseModule.forFeature([{ name: 'fat_checklist', schema: FATSchema }, { name: 'users', schema: UserSchema }]), FatProjectModule],
    providers: [FactoryAcceptanceTestService], 
    controllers: [FactoryAcceptanceTestController],
    exports: [FactoryAcceptanceTestService]
  })
export class FactoryAcceptanceTestModule {}
