import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigCatalogueModule } from '../config-catalogue/config-catalogue.module';
import { HardwareTypeController } from './hardware-type.controller';
import { HardwareTypeSchema } from './hardware-type.schema';
import { HardwareTypeService } from './hardware-type.service';

@Module({
    imports: [MongooseModule.forFeature([{ name: 'hardware_type', schema: HardwareTypeSchema }]), ConfigCatalogueModule],
    providers: [HardwareTypeService],
    controllers: [HardwareTypeController],
    exports: [HardwareTypeService]
})
export class HardwareTypeModule {}
