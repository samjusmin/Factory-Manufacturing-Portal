import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from '../user/user.schema';
import { ConfigCatalogueModule } from '../config-catalogue/config-catalogue.module';
import { ConfigLocationModule } from '../config-location/config-location.module';
import { HardwareTypeModule } from '../hardware-type/hardware-type.module';
import { PcImageModule } from '../pc-image/pc-image.module';
import { ConfigHardwareController } from './config-hardware.controller';
import { ConfigHardwareSchema } from './config-hardware.schema';
import { ConfigHardwareService } from './config-hardware.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'config_hardware', schema: ConfigHardwareSchema },
            { name: 'users', schema: UserSchema },
        ]),
        ConfigCatalogueModule, ConfigLocationModule, HardwareTypeModule, PcImageModule,
    ],
    providers: [ConfigHardwareService],
    controllers: [ConfigHardwareController],
    exports: [ConfigHardwareService]
  })
export class ConfigHardwareModule {}
