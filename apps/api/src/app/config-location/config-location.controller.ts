import { Controller, Get, Post, Body, Param, UseGuards, UseInterceptors, Req, Patch } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { ConfigLocationService } from './config-location.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { RolesGuard } from '../role/roles.guard';
import { Roles } from '../role/roles.decorator';
import { Role } from '../role/role.enum';
import { PcImageService } from '../pc-image/pc-image.service';
import { HardwareTypeService } from '../hardware-type/hardware-type.service';
import { LocationScopeGuard, userLocationNames } from '../role/location-scope.guard';

@Controller('config-location')
@UseGuards(JwtAuthGuard, AreasGuard)
@Areas('config')
export class ConfigLocationController {
    constructor(
        private readonly configLocationService: ConfigLocationService,
        private readonly pcImageService: PcImageService,
        private readonly hardwareTypeService: HardwareTypeService
    ) {}

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Get()
    async getAllLocations() {
        return this.configLocationService.findAll();
    }

    // The hardware models a location may pick for a unit of one category.
    @UseGuards(JwtAuthGuard, RolesGuard, LocationScopeGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get(':location/hardware/:category')
    async getAccessibleHardware(@Param('location') location: string, @Param('category') category: string) {
        const ids = await this.configLocationService.getAccessibleHardwareIDs(location);
        return this.hardwareTypeService.getAccessibleByCategory(ids, category);
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('mine')
    async getMyLocations(@Req() req) {
        return this.configLocationService.findByNames(userLocationNames(req.user));
    }

    // The PC images a location may pick for a unit of one hardware type.
    @UseGuards(JwtAuthGuard, RolesGuard, LocationScopeGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get(':location/:pcType')
    async getAccessibleImages(@Param('location') location: string, @Param('pcType') pcType: string){
        const ids = await this.configLocationService.getImageAccess(location);
        return this.pcImageService.getImageByIds(ids, pcType);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Post()
    async addEntry(@Body() configLocationUpdate: any) {
        if (configLocationUpdate && configLocationUpdate['type'] === 'ENTRY') {
            return this.configLocationService.addEntry(configLocationUpdate['data']);
        }
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Patch()
    async updateEntry(@Body() configLocationUpdate: any) {
        return this.configLocationService.updateEntry(configLocationUpdate && configLocationUpdate['data']);
    }
}
