import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { MailService } from './mail.service';
import * as rawbody from 'raw-body';
import { MailUpdateDTO } from './mail.update.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('mail')
export class MailController {
    constructor(private readonly mailService: MailService) {}

    @UseGuards(JwtAuthGuard)
    @Post()
    async sendEmail(@Req() req, @Body() mailUpdate: MailUpdateDTO) {
        console.log("Data:", mailUpdate);
        let sender = req.user.username;
        const result = await this.mailService.sendNotification(sender, mailUpdate);
        console.log(result);
    }

}
