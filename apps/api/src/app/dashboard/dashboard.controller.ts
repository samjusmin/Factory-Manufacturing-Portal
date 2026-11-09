import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get('summary')
    async getSummary() {
        return this.dashboardService.getSummary();
    }
}
