import { Body, Controller, Post, Req } from '@nestjs/common';
import { MailUpdateDTO } from '../mail/mail.update.dto';
import { ResetPasswordService } from './reset-password.service';

@Controller('reset-password')
export class ResetPasswordController {
    constructor(private readonly resetPassService: ResetPasswordService) {}

    @Post()
    async sendEmail(@Body() mailUpdate: MailUpdateDTO) {
        console.log("Data:", mailUpdate);
        const result = await this.resetPassService.resetPassword(mailUpdate);
        console.log(result);
    }
}
