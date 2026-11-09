import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { Roles } from '../role/roles.decorator';
import { Role } from '../role/role.enum';
import { RolesGuard } from '../role/roles.guard';
import { ConfigCatalogueService } from './config-catalogue.service';

// Everyone with Config reads the catalogue; only administrators change it.
@Controller('config-catalogue')
@UseGuards(JwtAuthGuard, AreasGuard, RolesGuard)
@UseInterceptors(ErrorInterceptor)
@Areas('config')
export class ConfigCatalogueController {
    constructor(private readonly catalogue: ConfigCatalogueService) {}

    // The categories with the names of their types.
    @Roles(Role.ADMIN, Role.OPERATOR)
    @Get()
    async list() {
        return this.catalogue.catalogue();
    }

    // The hardware types an image can be made for (types in categories that use a PC image).
    @Roles(Role.ADMIN, Role.OPERATOR)
    @Get('image-types')
    async imageTypes() {
        return this.catalogue.imageTypes();
    }

    // A type with its checklist: what a new unit of that type starts from.
    @Roles(Role.ADMIN, Role.OPERATOR)
    @Get('types/:name')
    async getType(@Param('name') name: string) {
        return this.catalogue.getType(name);
    }

    @Roles(Role.ADMIN)
    @Post('categories')
    async createCategory(@Body() dto: any) {
        return this.catalogue.createCategory(dto);
    }

    @Roles(Role.ADMIN)
    @Patch('categories/:name')
    async updateCategory(@Param('name') name: string, @Body() dto: any) {
        return this.catalogue.updateCategory(name, dto);
    }

    @Roles(Role.ADMIN)
    @Delete('categories/:name')
    async deleteCategory(@Param('name') name: string) {
        return this.catalogue.deleteCategory(name);
    }

    @Roles(Role.ADMIN)
    @Post('types')
    async createType(@Body() dto: any) {
        return this.catalogue.createType(dto);
    }

    @Roles(Role.ADMIN)
    @Delete('types/:name')
    async deleteType(@Param('name') name: string) {
        return this.catalogue.deleteType(name);
    }

    @Roles(Role.ADMIN)
    @Patch('types/:name/checklist')
    async saveChecklist(@Param('name') name: string, @Body() body: any) {
        return this.catalogue.saveChecklist(name, body && body.checklist);
    }
}
