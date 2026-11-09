import { Body, Controller, Get, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { Roles } from '../role/roles.decorator';
import { Role } from '../role/role.enum';
import { RolesGuard } from '../role/roles.guard';
import { ConfigHardwareService } from './config-hardware.service';
import { LocationScopeGuard } from '../role/location-scope.guard';

// Units: listed by location, category and type, opened by id, added and saved. The service checks that the caller may
// use the unit's location.
@Controller('config-hardware')
@UseGuards(JwtAuthGuard, AreasGuard, RolesGuard)
@UseInterceptors(ErrorInterceptor)
@Areas('config')
@Roles(Role.ADMIN, Role.OPERATOR)
export class ConfigHardwareController {
    constructor(
        private readonly configHardwareService: ConfigHardwareService
        ) {}

    @UseGuards(LocationScopeGuard)
    @Get('/:location/:category/:type')
    async findHardwareUnits(@Param('location') location: string, @Param('category') category: string, @Param('type') type: string) {
        return this.configHardwareService.findUnits(location, category, type);
    }

    @Get('/:id')
    async findHardwareUnit(@Param('id') id: string) {
        return this.configHardwareService.findUnit(id);
    }

    @Post()
    async addHardwareUnit(@Body() payload: any) {
        return this.configHardwareService.create(payload);
    }

    @Patch()
    async updateHardwareUnit(@Body() payload: any) {
        return this.configHardwareService.update(payload);
    }
}
