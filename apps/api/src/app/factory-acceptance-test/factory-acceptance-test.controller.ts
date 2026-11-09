import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { FactoryAcceptanceTestService } from './factory-acceptance-test.service';
import { newFATDTO, FATchecklist } from './factory-acceptance-test.update.dto';
import { FatProjectService } from '../fat-project/fat-project.service';
import { error } from 'console';
import { Roles } from '../role/roles.decorator';
import { Role } from '../role/role.enum';
import { RolesGuard } from '../role/roles.guard';
import { isAdminUser } from '../role/location-scope.guard';

@Controller('factory-acceptance-test')
@UseGuards(JwtAuthGuard, AreasGuard)
@Areas('fat')
export class FactoryAcceptanceTestController {
    constructor(
        private readonly fatService: FactoryAcceptanceTestService,
        private readonly fatProjectService: FatProjectService
        ) {}


    // Deep Search (admin only). These come first so they are not mistaken for /:project/:phase.
    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Get('serial-search/filters')
    async serialSearchFilters() {
        return this.fatService.serialSearchFilters();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Get('serial-search')
    async serialSearch(@Query() query: any) {
        return this.fatService.searchSerials(query);
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('/:project/:phase')
    async findPhaseUnits(@Param('project') project: string, @Param('phase') phase: string) {
        const fatDoc = await this.fatService.findUnits(project, phase);
        return fatDoc;
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Post()
    async createNewFAT(@Body() newFATDetails: any) {
        console.log("CREATENEWFAT IS RUNNING: ", newFATDetails);

        if (newFATDetails.type == "createnew") {
            // Checked before the phase is added, so a refused form does not leave an empty phase behind
            await this.fatService.assertNewUnitNumbers(newFATDetails.data[0].entries);
            const newId = await this.fatProjectService.addPhase(newFATDetails.data[0].project, newFATDetails.data[0].phase, newFATDetails.data[0].entries);
            newFATDetails.data[0].phase = newId;
            const result = await this.fatService.create(newFATDetails.data);
            console.log("WHAT IS NEW CREATION: ", newFATDetails.data);
            let phaseProgress = await this.fatService.calculatePhaseProgress(newFATDetails.data[0].project, newFATDetails.data[0].phase);
            let doc = await this.fatProjectService.updateProgress(newFATDetails.data[0].project, newFATDetails.data[0].phase, Math.round(phaseProgress));
            return result;
        } 

        else if (newFATDetails.type == "create") {
            const result = await this.fatService.create(newFATDetails.data);
            let phaseProgress = await this.fatService.calculatePhaseProgress(newFATDetails.data[0].project, newFATDetails.data[0].phase);
            let doc = await this.fatProjectService.updateProgress(newFATDetails.data[0].project, newFATDetails.data[0].phase, Math.round(phaseProgress));
            return result;
        } 
        
        else if (newFATDetails.type == "move") {
            const result = await this.fatService.moveUnits(newFATDetails.data[0]);

            let phaseProgress1 = await this.fatService.calculatePhaseProgress(newFATDetails.data[0].project, newFATDetails.data[0].toPhase);
            let doc1 = await this.fatProjectService.updateProgress(newFATDetails.data[0].project, newFATDetails.data[0].toPhase, Math.round(phaseProgress1));
            let phaseProgress2 = await this.fatService.calculatePhaseProgress(newFATDetails.data[0].project, newFATDetails.data[0].fromPhase);
            let doc2 = await this.fatProjectService.updateProgress(newFATDetails.data[0].project, newFATDetails.data[0].fromPhase, Math.round(phaseProgress2));
            
            return result;
        }
        
        else if (newFATDetails.type == "addChecklists") {
            const result = await this.fatService.addChecklists(newFATDetails.data[0]);
            await Promise.all(result.map(unit => this.fatService.calculateUnitProgress(unit.project, unit.phase, unit.doc_no)));
            let phaseProgress = await this.fatService.calculatePhaseProgress(newFATDetails.data[0].project, newFATDetails.data[0].phase);
            let doc = await this.fatProjectService.updateProgress(newFATDetails.data[0].project, newFATDetails.data[0].phase, Math.round(phaseProgress));
            return;
        }
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @UseInterceptors(ErrorInterceptor)
    @Roles(Role.ADMIN)
    @Post('/:project/:phase')
    async getPhaseChecklists(@Body() docs: any) {
        const fatDocs = await this.fatService.findMultipleUnitsByDocNo(docs.data);
        console.log("getPhaseChecklists gets:", fatDocs);
        return fatDocs;
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('/:project/:phase/:unit')
    async findUnitCat(@Param('project') project: string, @Param('phase') phase: string, @Param('unit') unit: string) {
        if (unit == "getOutstanding") {
            return this.fatService.phaseOutstanding(project, phase);
        } else if (unit == "getTypes") {
            const fatDoc = await this.fatService.findTypesinPhase(project, phase);
            return fatDoc;
        } else if (unit == "getAllUnitComments") {
            console.log("getAllUnitComments is running")
            const fatDoc = await this.fatService.findPhaseUnitComments(project, phase);
            console.log("getAllUnitComments gets:", fatDoc);
            return fatDoc;
        } else {
            const fatDoc = await this.fatService.findCat(project, phase, unit);
            return fatDoc;
            
        }
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('/:project/:phase/:unit/:category')
    async findUnitCheck(@Param('project') project: string, @Param('phase') phase: string, @Param('unit') unit: string, @Param('category') category: string, @Res({ passthrough: true }) res?: any) {
        if (category == "getOutstanding") {
            return this.fatService.unitOutstanding(project, phase, unit);
        }
        else if (category == "getTypeUnits") {
            const units = await this.fatService.findTypeUnits(project, phase, unit);
            if (units.length === 0) {
                throw new NotFoundException('There are no units of that type here.');
            }
            const categories = await this.fatService.findCat(project, phase, units[0].doc_no);
            return {units: units, categories: categories[0].category};
        }
        else if (category == "getUnitComments") {
            const comment = await this.fatService.findUnitComment(project, phase, unit);
            console.log("THIS IS THE COMMENT", comment);
            return comment;
        }
        else {
            // Reading a checklist must not change anything: progress is worked out when checks are saved.
            const fatDoc = await this.fatService.findCheck(project, phase, unit, category);
            if (fatDoc.length === 0) {
                return fatDoc;
            } else {
                // The version of the category the rows came from; a save must name it (see saveChecklist)
                if (res) {
                    res.setHeader('X-Checklist-Version', String(fatDoc[0].version || 0));
                }
                return fatDoc[0].checklist;
            }
        }
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Patch()
    async editEntry(@Body() edit: any, @Req() req) {
        // Removing a category and editing the global checklist template change data for everyone, so they are
        // admin-only. Ticking checks ("update") and unit notes ("comment") stay open to anyone who can see the unit.
        if ((edit['type'] == "remove" || edit['type'] == "edit") && !isAdminUser(req.user)) {
            throw new ForbiddenException('Admin access is required for this change');
        }

        if (edit['type'] == "update") {
            try {
                const result = await this.fatService.updateChecklist(edit['element']);
                // Waited for: the page reloads the progress straight after, and a failure here must reach the error
                // handling rather than bring the whole server down.
                await this.fatService.updateProgress(edit['element'].project, edit['element'].phase, edit['element'].unit, edit['element'].category);
                return result;
            } catch(e) {
                throw e;
            }
            
        } else if (edit['type'] == "remove") {
            const result = await this.fatService.removeCategory(edit['element']);
            await this.fatService.updateProgress(edit['element'].project, edit['element'].phase, edit['element'].unit, edit['element'].category);
            return result;
        } else if (edit['type'] == "edit") {
            const result = await this.fatService.editChecklist(edit['element']);
        } else if (edit['type'] == "comment") {
            const result = await this.fatService.updateUnitComment(edit['element']);
            console.log("THIS IS THE UPDATEUNITCOMMENT", result);
        }
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('/:category')
    async getChecklists(@Param('category') category: string) {
        const fatDoc = await this.fatService.getChecklist(category);
        return fatDoc;
    }
}
