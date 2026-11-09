import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReportIssuesService } from './report-issues.service';
import { ReportIssuesController } from './report-issues.controller';
import { ReportIssuesSchema } from './report-issues.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'report_issues', schema: ReportIssuesSchema }]), MailModule],
  providers: [ReportIssuesService],
  controllers: [ReportIssuesController]
})
export class ReportIssuesModule {}
