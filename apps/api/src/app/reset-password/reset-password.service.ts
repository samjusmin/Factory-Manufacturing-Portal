import { Injectable } from '@nestjs/common';
import { MailerService } from "@nestjs-modules/mailer";
import { MailUpdateDTO } from '../mail/mail.update.dto';

@Injectable()
export class ResetPasswordService {
    constructor(private mailerService: MailerService) {}
    
    async resetPassword(mailDetail: MailUpdateDTO) {

      //let htmlMessage = mailDetail.message;
      
      let info = await this.mailerService.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.NOTIFICATION_RECEIPT,
        subject: mailDetail.subject,
        text: "Password reset requested for " + mailDetail.message, // plain text body
        html: "Password reset requested for " + mailDetail.message, // html body
      }).then((success) => { console.log("Message sent: %s", success) })
      .catch((error) => { console.log("Error:", error) });
    }
}
