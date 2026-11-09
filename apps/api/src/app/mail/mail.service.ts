import { Inject, Injectable, LoggerService } from '@nestjs/common';
import { MailerService } from "@nestjs-modules/mailer";
import { MailUpdateDTO } from './mail.update.dto';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class MailService {
    constructor(private mailerService: MailerService,
      @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {}
    
    async sendNotification(sender: string, mailDetail: MailUpdateDTO) {

      let htmlMessage = mailDetail.message.replace(/(?:\r\n|\r|\n)/g, '<br>');
      
      let info = await this.mailerService.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFICATION_RECEIPT,
        subject: mailDetail.subject,
        text: "From " + sender + ":\r\n\r\n" + mailDetail.message, // plain text body
        html: "From " + sender + ":<br><br>" + htmlMessage, // html body
      }).then((success) => { this.logger.log("Message sent: %s", success) })
      .catch((error) => { this.logger.error("Error:", error) });
    }
}
