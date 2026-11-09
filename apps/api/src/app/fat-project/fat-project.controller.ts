import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { FatProjectService } from './fat-project.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { FATProjectDTO } from './fat-project.update.dto';
import { Roles } from '../role/roles.decorator';
import { Role } from '../role/role.enum';
import { RolesGuard } from '../role/roles.guard';

@Controller('fat-project')
@UseGuards(JwtAuthGuard, AreasGuard)
@Areas('fat')
export class FatProjectController {

    constructor(
        private readonly fatProjectService: FatProjectService,
    ) {}

    // Getting all the projects from the project collection
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get()
    async findFATProject() {
        const fatDoc = await this.fatProjectService.findProjects();
        return fatDoc;
    }

    // Adding a new project
    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Post()
    async addEntry(@Body() fatNewProject: FATProjectDTO, @Req() req) {
        const result = await this.fatProjectService.addProject(fatNewProject);
        return result;
    }

    // Getting the phases of a project
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get(':project')
    async findFATPhase(@Param('project') project: string) {
        if(project === "adminCheck") {
            return await this.fatProjectService.checkIfUserIsAdmin(); 
        } else {
            const fatPhases = await this.fatProjectService.findPhases(project);
            if (fatPhases.length === 0) {
                return fatPhases
            }
            return fatPhases;
        }
    }

    // Getting the phase name of a project
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('/:project/:phase')
    async findFATPhaseName(@Param('project') project: string, @Param('phase') phaseId: string) {
            const phaseName = await this.fatProjectService.findPhaseById(project, phaseId);
            return phaseName;
    }

    // Adding a new phase in a project
    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Post(':project')
    async addPhase(@Body() project: string, phase: string, @Req() req) {
        let type = project[3];
        if (type === "addPhase") {
            const result = await this.fatProjectService.addPhase(project[0], project[1], project[2]);
        } else if (type === "updateCheckers"){
            const result = await this.fatProjectService.updatePhaseCheckers(project[0], project[1], project[2]);
        }
        return;
    }

    // Adding a new phase in a project
    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Patch()
    async editPhase(@Body() data: any) {
        const result = await this.fatProjectService.updatePhaseName(data.project, data.phaseID, data.newName);
        return result;
    }
    
}
