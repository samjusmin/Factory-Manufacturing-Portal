import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigCatalogueModule } from '../config-catalogue/config-catalogue.module';
import { PcImageController } from './pc-image.controller';
import { PcImageSchema } from './pc-image.schema';
import { PcImageService } from './pc-image.service';

@Module({
    imports: [MongooseModule.forFeature([{ name: 'pc_image', schema: PcImageSchema }]), ConfigCatalogueModule],
    providers: [PcImageService],
    controllers: [PcImageController],
    exports: [PcImageService]
})
export class PcImageModule {}
