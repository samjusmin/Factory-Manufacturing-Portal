import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigHardwareSchema } from '../config-hardware/config-hardware.schema';
import { ConfigLocationSchema } from '../config-location/config-location.schema';
import { HardwareTypeSchema } from '../hardware-type/hardware-type.schema';
import { PcImageSchema } from '../pc-image/pc-image.schema';
import { ConfigCatalogueController } from './config-catalogue.controller';
import { ConfigCategorySchema, ConfigTypeSchema } from './config-catalogue.schema';
import { ConfigCatalogueService } from './config-catalogue.service';

// The catalogue reads the other Config collections only to refuse deleting something that is still in use.
@Module({
    imports: [MongooseModule.forFeature([
        { name: 'config_category', schema: ConfigCategorySchema },
        { name: 'config_type', schema: ConfigTypeSchema },
        { name: 'config_hardware', schema: ConfigHardwareSchema },
        { name: 'config_location', schema: ConfigLocationSchema },
        { name: 'hardware_type', schema: HardwareTypeSchema },
        { name: 'pc_image', schema: PcImageSchema },
    ])],
    providers: [ConfigCatalogueService],
    controllers: [ConfigCatalogueController],
    exports: [ConfigCatalogueService]
})
export class ConfigCatalogueModule {}
