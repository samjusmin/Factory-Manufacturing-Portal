import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    BadGatewayException,
    CallHandler,
    NotFoundException,
    ConflictException,
    BadRequestException,
    ForbiddenException,
    ServiceUnavailableException,
    InternalServerErrorException,
    Inject
  } from '@nestjs/common';
  import { Observable, throwError } from 'rxjs';
  import { catchError } from 'rxjs/operators';
  import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
  import { Logger } from 'winston';


@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,

  ) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle()
      .pipe(catchError(error => {
        console.log("What is e: ", error)
        if (error instanceof NotFoundException || error instanceof ForbiddenException || error instanceof ConflictException || error instanceof BadRequestException) {
            throw error;
        } else {
          this.logger.error("Logger here", error);
          throw new InternalServerErrorException(error);
        }
      }));
  }
}