import { Controller, Get, Post, Body, Param, UseGuards, UseFilters, UseInterceptors, Res, Req, Patch } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { HardwareTypeService } from './hardware-type.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { RolesGuard } from '../role/roles.guard';
import { Roles } from '../role/roles.decorator';
import { Role } from '../role/role.enum';


@Controller('hardware-type')
@UseGuards(JwtAuthGuard, AreasGuard)
@Areas('config')
export class HardwareTypeController {
    constructor(private readonly HardwareTypeService: HardwareTypeService) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Get()
    async getAllHardwareTypes() {
        console.log("RUNNING getAllHardwareTypes GET");
        const hardwareTypes = await this.HardwareTypeService.findAll();
        console.log("This is the hardwareTypes: ", hardwareTypes);
        return hardwareTypes;   
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Get('/list')
    async getHardwareList() {

        console.log('Running getHardwareList');
        const hardwareTypeList = await this.HardwareTypeService.getHardwareList();
        console.log("This is the hardwareTypes: ", hardwareTypeList);
        return hardwareTypeList;
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Patch()
    async updateHardwareType(@Body() updateData: any) {
        console.log("updateData received:", updateData);
        const hardwareDoc = await this.HardwareTypeService.updateHardwareType(updateData);
        console.log("THIS IS THE PATCHED: " + hardwareDoc)
        return hardwareDoc;
    }

    // @UseGuards(JwtAuthGuard)
    // @UseInterceptors(ErrorInterceptor)
    // @Post()
    // async addEntry(@Body() PcImageUpdate: any, @Req() req) {
    //     console.log("RUNNING THE ADDENTRY POST");
    //     if (PcImageUpdate['type'] === 'ENTRY') {
    //         console.log("Running POST ENTRY: \n", PcImageUpdate);
    //         const result = await this.HardwareTypeService.addEntry(PcImageUpdate['data']);
    //         console.log("Result POST ENTRY: \n", result);
    //         return result;
    //     }
    //     else if (PcImageUpdate['type'] === 'UPDATE') {
    //         console.log("Running POST UPDATE: \n", PcImageUpdate);
    //         const result = await this.HardwareTypeService.updateEntry(PcImageUpdate['data']);
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
    //         const result = await this.HardwareTypeService.updateUser(trainRegUpdate['element']);
    //         return result;
    //     } else if (trainRegUpdate['type'] == "remove") {  
    //         const result = await this.HardwareTypeService.removeEntry(trainRegUpdate['element']);
    //         return result;
    //     }
    // }


}