import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { TrainRegService } from './train-reg.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { RolesGuard } from '../role/roles.guard';
import { Roles } from '../role/roles.decorator';
import { Role } from '../role/role.enum';

// The training register. Admin only.
@Controller('train-reg')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ErrorInterceptor)
@Roles(Role.ADMIN)
export class TrainRegController {
    constructor(private readonly trainRegService: TrainRegService) {}

    // Every location with its people and a short summary of each person's training.
    @Get('locations')
    async locations() {
        return this.trainRegService.locations();
    }

    // One person in full.
    @Get('users/:username')
    async user(@Param('username') username: string) {
        return this.trainRegService.userDetail(username);
    }

    // Records a module as completed on a date: { module, date: 'YYYY-MM-DD' }.
    @Post('users/:username/completions')
    async record(@Param('username') username: string, @Body() body: any) {
        return this.trainRegService.recordCompletion(username, body);
    }

    // Removes a completion. The module is a query value because names such as Picking/Packing contain a slash.
    @Delete('users/:username/completions')
    async clear(@Param('username') username: string, @Query('module') module: string) {
        return this.trainRegService.clearCompletion(username, module);
    }

    // Sets the roles a person holds: { areas: ['warehouse', 'fat'] }.
    @Patch('users/:username/areas')
    async areas(@Param('username') username: string, @Body() body: any) {
        return this.trainRegService.setAreas(username, body && body.areas);
    }
}
