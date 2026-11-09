import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FATProjectSchema } from './fat-project.schema';
import { FatProjectService } from './fat-project.service';
import { FatProjectController } from './fat-project.controller';

@Module({
    imports: [MongooseModule.forFeature([{ name: 'fat_project', schema: FATProjectSchema }])],
    providers: [FatProjectService],
    controllers: [FatProjectController],
    exports: [FatProjectService]
})
export class FatProjectModule {}
