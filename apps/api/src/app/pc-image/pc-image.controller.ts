import { Controller, Get, Post, Body, Param, UseGuards, UseFilters, UseInterceptors, Res, Req, Patch } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { PcImage } from './pc-image.schema';
import { PcImageService } from './pc-image.service';
import { PcImageUpdateDTO } from './pc-image.update.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { RolesGuard } from '../role/roles.guard';
import { Roles } from '../role/roles.decorator';
import { Role } from '../role/role.enum';


@Controller('pc-image')
@UseGuards(JwtAuthGuard, AreasGuard)
@Areas('config')
export class PcImageController {
    constructor(private readonly PcImageService: PcImageService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Get()
    async getAllPcImages() {
        console.log("RUNNING getAllPcImages GET");
        const pcImageList = await this.PcImageService.findAll();
        console.log("This is the pcImageList: ", pcImageList);
        return pcImageList;   
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Get('/:type')
    async getTypePCImages(@Param('type') type: string) {
        console.log("RUNNING getTypePCImages GET");
        if (type === 'tree') {
            const pcImageList = await this.PcImageService.getImageTree();
            console.log("This is the pcImageList: ", pcImageList);
            return pcImageList;   
        }
        else {
            const pcImageList = await this.PcImageService.findByType(type);
            console.log("This is the pcImageList: ", pcImageList);
            return pcImageList;  
        } 
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Patch()
    async updatePcImage(@Body() updateData: any) {
        console.log("updateData received:", updateData);

        const imageDoc = await this.PcImageService.updateImage(updateData);
        console.log("THIS IS THE PATCHED: " + imageDoc)
        return imageDoc;
    }

    // @UseGuards(JwtAuthGuard)
    // @UseInterceptors(ErrorInterceptor)
    // @Post()
    // async addEntry(@Body() PcImageUpdate: any, @Req() req) {
    //     console.log("RUNNING THE ADDENTRY POST");
    //     if (PcImageUpdate['type'] === 'ENTRY') {
    //         console.log("Running POST ENTRY: \n", PcImageUpdate);
    //         const result = await this.PcImageService.addEntry(PcImageUpdate['data']);
    //         console.log("Result POST ENTRY: \n", result);
    //         return result;
    //     }
    //     else if (PcImageUpdate['type'] === 'UPDATE') {
    //         console.log("Running POST UPDATE: \n", PcImageUpdate);
    //         const result = await this.PcImageService.updateEntry(PcImageUpdate['data']);
    //         console.log("Result UPDATE ENTRY: \n", result);
    //         return result;
    //     }
    // }

    // @UseGuards(JwtAuthGuard)
    // @UseInterceptors(ErrorInterceptor)
    // @Patch()
    // async updateEntry(@Body() trainRegUpdate: TrainRegUpdateDTO, @Req() req) {
    //     console.log("RUNNING THE REMOVE_ENTRY PATCH");
    //     if (trainRegUpdate['type'] == "update") {
    //         const result = await this.PcImageService.updateUser(trainRegUpdate['element']);
    //         return result;
    //     } else if (trainRegUpdate['type'] == "remove") {  
    //         const result = await this.PcImageService.removeEntry(trainRegUpdate['element']);
    //         return result;
    //     }
    // }


}