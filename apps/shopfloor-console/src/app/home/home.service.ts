import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { IDashboardSummary } from '@webproject/data';
import { SKIP_LOADING_HEADER } from '../error/http-loading.interceptor';

@Injectable({
  providedIn: 'root'
})
export class HomeService {

  constructor(private http: HttpClient) { }

  // Returns an Observable and keeps no state, so it cannot disturb the list pages' shared
  // services. The Home page shows its own loading state, so the blocking dialog is skipped.
  getSummary(): Observable<IDashboardSummary> {
    const headers = new HttpHeaders({
      Authorization: 'Bearer ' + localStorage.getItem('token'),
      [SKIP_LOADING_HEADER]: 'true'
    });
    return this.http.get<IDashboardSummary>('/api/dashboard/summary', { headers });
  }
}
