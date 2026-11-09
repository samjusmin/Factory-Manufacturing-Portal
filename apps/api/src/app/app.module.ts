import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { ProdOrderModule } from './prod-order/prod-order.module';
import { StockkeepingModule } from './stockkeeping/stockkeeping.module';
import { ReportIssuesModule } from './report-issues/report-issues.module';
import { FactoryAcceptanceTestModule } from './factory-acceptance-test/factory-acceptance-test.module';
import { MailModule } from './mail/mail.module';
import { TrainRegModule } from './train-reg/train-reg.module';
import { ResetPasswordModule } from './reset-password/reset-password.module';
import { AuthModule } from './auth/auth.module';
import { PassportModule } from '@nestjs/passport';
import { SeedService } from './seed/seed.service';
import { FatProjectModule } from './fat-project/fat-project.module';
import { ConfigCatalogueModule } from './config-catalogue/config-catalogue.module';
import { ConfigLocationModule } from './config-location/config-location.module';
import { ConfigHardwareModule } from './config-hardware/config-hardware.module';
import { PcImageModule } from './pc-image/pc-image.module';
import { HardwareTypeModule } from './hardware-type/hardware-type.module';
import { DashboardModule } from './dashboard/dashboard.module';

import { APP_INTERCEPTOR } from '@nestjs/core';
import { ErrorInterceptor } from './error/error.interceptor';

import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import  * as DailyRotateFile from 'winston-daily-rotate-file';



@Module({
  imports: [PurchaseOrderModule, ProdOrderModule, StockkeepingModule, ReportIssuesModule, MailModule, ResetPasswordModule, AuthModule, FactoryAcceptanceTestModule, TrainRegModule, FatProjectModule, ConfigCatalogueModule, ConfigLocationModule, ConfigHardwareModule, PcImageModule, HardwareTypeModule, DashboardModule,
    ConfigModule.forRoot({
      envFilePath: ['.env.development', '.env.production'],
      isGlobal: true,
    }),
    PassportModule.register({ defaultStrategy: 'local' }),
    // No external MongoDB required: when MONGODB_URL isn't set, spin up an
    // in-memory MongoDB instance for the lifetime of the process so the app
    // works out of the box. Set MONGODB_URL to point at a real server instead.
    MongooseModule.forRootAsync({
      useFactory: async () => {
        if (process.env.MONGODB_URL) {
          return { uri: process.env.MONGODB_URL };
        }
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        return { uri: mongod.getUri() };
      },
    }),
    WinstonModule.forRoot({
      exitOnError: false,
      transports: [
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD-HH',
          zippedArchive: true,
          maxSize: '20m',
        }),
        new winston.transports.Console({
          format: winston.format.combine(
            //winston.format.label({ label: __filename }),
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(
              info => `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`
            )
          ),
        }),
     
      ],
    }),
  ],
  controllers: [AppController],
  providers: [AppService, SeedService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorInterceptor,
    },],
  exports: [
		PassportModule.register({ defaultStrategy: 'local' }),
	]
})
export class AppModule {}
