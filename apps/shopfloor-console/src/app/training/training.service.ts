import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ITrainingLocation, ITrainingUserDetail, TrainingArea } from '@webproject/data';
import { SKIP_LOADING_HEADER } from '../error/http-loading.interceptor';

// The Training register calls. Returns Observables and keeps no state, so each page holds what it shows.
// Changes made on the person's page skip the blocking loading dialog: the page shows its own "saving" state.
@Injectable({
  providedIn: 'root'
})
export class TrainingService {

  constructor(private http: HttpClient) { }

  private headers(quiet = false): HttpHeaders {
    let headers = new HttpHeaders({ Authorization: 'Bearer ' + localStorage.getItem('token') });
    if (quiet) {
      headers = headers.set(SKIP_LOADING_HEADER, 'true');
    }
    return headers;
  }

  private userUrl(username: string): string {
    return '/api/train-reg/users/' + encodeURIComponent(username);
  }

  locations(): Observable<ITrainingLocation[]> {
    return this.http.get<ITrainingLocation[]>('/api/train-reg/locations', { headers: this.headers() });
  }

  user(username: string): Observable<ITrainingUserDetail> {
    return this.http.get<ITrainingUserDetail>(this.userUrl(username), { headers: this.headers() });
  }

  // Records a module as completed on a date (YYYY-MM-DD), replacing any earlier record of it.
  record(username: string, module: string, date: string): Observable<ITrainingUserDetail> {
    return this.http.post<ITrainingUserDetail>(this.userUrl(username) + '/completions', { module, date }, { headers: this.headers(true) });
  }

  clear(username: string, module: string): Observable<ITrainingUserDetail> {
    return this.http.delete<ITrainingUserDetail>(this.userUrl(username) + '/completions', {
      headers: this.headers(true),
      params: { module },
    });
  }

  setAreas(username: string, areas: TrainingArea[]): Observable<ITrainingUserDetail> {
    return this.http.patch<ITrainingUserDetail>(this.userUrl(username) + '/areas', { areas }, { headers: this.headers(true) });
  }
}
