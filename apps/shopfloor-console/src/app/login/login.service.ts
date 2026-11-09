import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

@Injectable({
  providedIn: 'root'
})
export class LoginService {

  postData: Array<{location: string}> = [];

  constructor(
    private http: HttpClient,
    public dialog: MatDialog,) { }

  loginValue = new Subject<string>();

  set currentUser(user: any) {
    if (user.name) {
      console.log("User", user);
      this.loginValue.next(user.name);
      localStorage.setItem('name', user.name);
      localStorage.setItem('token', user.access_token);
      localStorage.setItem('location', user.location || '');
      localStorage.setItem('role', user.role);
      localStorage.setItem('locations', JSON.stringify(user.locations || []));
      localStorage.setItem('areas', JSON.stringify(user.areas || []));
    }
    else {
      localStorage.removeItem('token');
      localStorage.removeItem('name');
      localStorage.removeItem('location');
      localStorage.removeItem('role');
      localStorage.removeItem('locations');
      localStorage.removeItem('areas');
      this.loginValue.next('');
    }
  }

  get currentUser() {
    return localStorage.getItem('name');
  }
}
