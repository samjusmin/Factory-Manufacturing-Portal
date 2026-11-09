import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigHardwareSchema } from '../config-hardware/config-hardware.schema';
import { ConfigCatalogueModule } from '../config-catalogue/config-catalogue.module';
import { ConfigLocationController } from './config-location.controller';
import { ConfigLocationSchema } from './config-location.schema';
import { ConfigLocationService } from './config-location.service';
import { PcImageModule } from '../pc-image/pc-image.module';
import { HardwareTypeModule } from '../hardware-type/hardware-type.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'config_location', schema: ConfigLocationSchema },
            { name: 'config_hardware', schema: ConfigHardwareSchema },
        ]),
        ConfigCatalogueModule, PcImageModule, HardwareTypeModule,
    ],
    providers: [ConfigLocationService],
    controllers: [ConfigLocationController],
    exports: [ConfigLocationService]
})
export class ConfigLocationModule {}
