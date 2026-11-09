import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { ResetPasswordController } from './reset-password.controller';
import { ResetPasswordService } from './reset-password.service';

@Module({
    providers: [ResetPasswordService],
    controllers: [ResetPasswordController],
    imports: [MailModule]
})
export class ResetPasswordModule {}
