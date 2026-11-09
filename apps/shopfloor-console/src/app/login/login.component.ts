import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { LoginService } from './login.service';

@Component({
  selector: 'webproject-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

  form: FormGroup;
  loading = false;
  submitted = false;
  returnUrl: string;
  loginData = { username: '', password: '' };

  constructor(
    private _location: Location,
    private formBuilder: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private loginService: LoginService
  ) { }

  showPassword = false;

  ngOnInit() {
    this.form = this.formBuilder.group({
        username: ['', Validators.required],
        password: ['', Validators.required]
    });
    // Typing again clears "that did not match", so it does not linger while the user corrects it.
    this.form.valueChanges.subscribe(() => {
      if (this.form.errors && this.form.errors['loginError']) {
        this.form.setErrors(null);
      }
    });
  }

  // The demo accounts, for trying the app: each one's password is its name followed by 123.
  fillDemo(username: string) {
    this.form.setValue({ username, password: username + '123' });
    this.showPassword = false;
  }

  // convenience getter for easy access to form fields
  get f() { return this.form.controls; }

  onSubmit() {
      this.submitted = true;

      // stop here if form is invalid
      if (this.form.invalid) {
          return;
      }

      this.loading = true;
      this.loginData.username = this.f.username.value;
      this.loginData.password = this.f.password.value;
      this.http.post<any>('/api/auth/login/', this.loginData).subscribe(
        (data) => {
          this.loading = false;
          this.loginService.currentUser = data;
          window.location.href = window.location.protocol + '//' + window.location.host + '/';
          /*this.router.navigate(['/FAT-project-list']).then(() => {
            window.location.reload();
          });*/
        },
        (error) => {
          this.loading = false;
          this.form.setErrors({"loginError": true});
        }
      )
  }

}
