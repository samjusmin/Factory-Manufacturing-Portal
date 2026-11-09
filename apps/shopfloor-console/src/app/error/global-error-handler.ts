import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorDialogService } from '../error-handling/errors/error-dialog.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(
    private router: Router,
    private errorDialogService: ErrorDialogService,
    private zone: NgZone
  ) {}

    handleError(error: any) {
        console.log("THIS ERROR IS BEING HANDLED");
        console.log("Error:", error);
        console.log("message", error.message);

        if (error instanceof HttpErrorResponse) {
            if (error.error.statusCode == 401) {
                this.zone.run(() => this.router.navigate(['/login']));
                return;
            }
            else {
                error = error.error;
            }
        }

        
    // Check if it's an error from an HTTP response
    // if (!(error instanceof HttpErrorResponse)) {
    //   error = error.rejection; // get the error object
    // }
        this.zone.run(() =>
            this.errorDialogService.openDialog(
                error?.message || 'Undefined client error',
                error?.status
            )
        );

        console.error('Error from global error handler', error);
  }
}