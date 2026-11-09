import { Controller, Get, Post, Body, Param, UseGuards, Req, UseInterceptors } from '@nestjs/common';
import { AreasGuard } from '../role/areas.guard';
import { Areas } from '../role/areas.decorator';
import { ReportIssuesService } from './report-issues.service';
import { ReportIssuesUpdateDTO } from './report-issues.update.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ErrorInterceptor } from '../error/error.interceptor';
import { MailService } from '../mail/mail.service';

@Controller('report-issues')
@UseGuards(JwtAuthGuard, AreasGuard)
@Areas('warehouse')
export class ReportIssuesController {
    constructor(
        private readonly reportIssuesService: ReportIssuesService,
        private readonly mailService: MailService
    ) {}

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Get(':doc')
    async getBydDoc(@Param('doc') doc: string) {
        const result = await this.reportIssuesService.findByDoc(doc);
        return result;
    }

    @UseGuards(JwtAuthGuard)
    @UseInterceptors(ErrorInterceptor)
    @Post()
    async createReportIssues(@Body() reportIssuesUpdate: ReportIssuesUpdateDTO[], @Req() req) {
        console.log("Data:", req);
        let sender = req.user.username;
        const result = await this.reportIssuesService.createIssues(reportIssuesUpdate);
        const report = await this.mailService.sendNotification(sender, {subject: "Reporting issue for " + reportIssuesUpdate[0].doc_no, message: JSON.stringify(reportIssuesUpdate, null, "\t")});
        return result;
    }


}
