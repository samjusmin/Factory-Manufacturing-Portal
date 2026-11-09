/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { urlencoded, json } from 'express';

import { AppModule } from './app/app.module';

// Work that nothing is waiting for must not take the whole server down if it fails: log it and keep serving everyone else.
process.on('unhandledRejection', (reason: any) => {
  Logger.error('Unhandled failure: ' + (reason && reason.stack ? reason.stack : reason));
});


async function bootstrap() {

  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  app.use(json({limit: '50mb'}));
  app.use(urlencoded({limit: '50mb', extended: true}));
  const port = process.env.PORT || 3333;
  await app.listen(port, () => {
    Logger.log('Listening at http://localhost:' + port + '/' + globalPrefix);
  });
}

bootstrap();
