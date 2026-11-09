import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailController } from './mail.controller';

@Module({
  providers: [MailService],
  controllers: [MailController],
  imports: [
    MailerModule.forRootAsync({
       useFactory: async (config: ConfigService) => {
         const host = config.get<string>('EMAIL_HOST');
         if (!host) {
           // No SMTP server configured: use nodemailer's json transport so mail
           // "sends" successfully (logged, not delivered) instead of failing to connect.
           return { transport: { jsonTransport: true } };
         }
         return {
           transport: {
             name: config.get<string>('EMAIL_NAME'),
             host,
             port: config.get<number>('EMAIL_PORT'),
             secure: Boolean(JSON.parse(config.get<string>('EMAIL_SECURE') || 'false')),
             auth: {
                 user: config.get<string>('EMAIL_USER'),
                 pass: config.get<string>('EMAIL_PASS'),
             }
           }
         };
       },
       inject: [ConfigService],
    })
],
exports: [MailService]
})
export class MailModule {
  

}

