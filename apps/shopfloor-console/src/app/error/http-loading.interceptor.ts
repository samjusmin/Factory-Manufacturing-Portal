import {
    HttpHandler,
    HttpRequest,
    HttpEvent,
    HttpInterceptor,
  } from '@angular/common/http';
  import { Observable } from 'rxjs';
  import { finalize } from 'rxjs/operators';
  import { LoadingDialogService } from '../error-handling/loading/loading-dialog.service';
  import { Injectable } from '@angular/core';

  // Requests that draw their own loading state (e.g. the Home dashboard) send this header
  // to skip the blocking dialog. It is removed before the request goes out.
  export const SKIP_LOADING_HEADER = 'X-Skip-Loading';

  @Injectable()
  export class HttpLoadingInterceptor implements HttpInterceptor {
    constructor(private loadingDialogService: LoadingDialogService) {}

    intercept(
      request: HttpRequest<any>,
      next: HttpHandler
    ): Observable<HttpEvent<any>> {
      if (request.headers.has(SKIP_LOADING_HEADER)) {
        return next.handle(request.clone({ headers: request.headers.delete(SKIP_LOADING_HEADER) }));
      }
      this.loadingDialogService.openDialog();
      return next.handle(request).pipe(
        finalize(() => {
          this.loadingDialogService.hideDialog();
        })
      ) as Observable<HttpEvent<any>>;
    }
  }
