import { Model } from 'mongoose';
import { Injectable, Scope, Inject, NotFoundException, LoggerService } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ReportIssues, ReportIssuesDocument } from './report-issues.schema';
import { ReportIssuesUpdateDTO } from './report-issues.update.dto';

const util = require('util')
var request = require('request');
const requestPromise = util.promisify(request);
var username = '';
var contextName = 'ReportIssuesService: ';


@Injectable()
export class ReportIssuesService {

    constructor(
        @InjectModel('report_issues') private ReportIssuesModel: Model<ReportIssuesDocument>,
        @Inject(REQUEST) private request: Request,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    ) {}


    async findByDoc(doc_no): Promise<ReportIssues[]> {
      username = this.request.user['username'];

      this.logger.info("Username: " + username, {label: contextName + this.findByDoc.name});
      return await this.ReportIssuesModel.find({ "doc_no": doc_no }).exec();
  }

    async createIssues(reportIssuesDetail: ReportIssuesUpdateDTO[]) {
        await this.ReportIssuesModel.bulkWrite(
            reportIssuesDetail.map(({ item_no, revision, description, project, doc_no, qty_issue, issue_type, status, shp_ref, note }) => 
              ({
                "insertOne": {
                    "document": {
                      "date" : new Date(),
                      "item_no" : item_no,
                      "revision": revision,
                      "description": description,
                      "project" : project,
                      "doc_no" : doc_no,
                      "qty_issue" : qty_issue,
                      "issue_type" : issue_type,
                      "status": status,
                      "shp_ref": shp_ref,
                      "note": note
                    }
                }
              })
            )
          )
          .catch((error) => {
              this.logger.error(error);
              throw error;
          });
        this.logger.info(username + " has sucessfully created new issues entry " + reportIssuesDetail, {label: contextName + this.createIssues.name});
    }
}