import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { GeneralDialogBoxComponent } from '../dialog-box/general-dialog/general-dialog-box';

@Component({
  selector: 'webproject-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  emailData = { subject: '', message: '' };
  sending = false;

  constructor(
    private http: HttpClient,
    private formBuilder: FormBuilder,
    private router: Router,
    public dialog: MatDialog
  ) { }

  ngOnInit() {
    this.form = this.formBuilder.group({
      resetPass: ['', [Validators.required, Validators.email]],
    });
  }

  openDialog() {
    const dialogRef = this.dialog.open(GeneralDialogBoxComponent,{
      data: { 
        title: "Password Reset Request Submitted",
        message: "We are currently reviewing your request and will endeavour to send you the new password within 24 hours." },
    });

    // Once the confirmation is closed there is nothing more to do here, so go back to the sign-in page.
    dialogRef.afterClosed().subscribe(() => this.router.navigateByUrl('/login'));
  }

  sendEmail() {
    if (this.form.invalid || this.sending) {
      this.form.markAllAsTouched();
      return;
    }
    this.sending = true;
    this.emailData.subject = "Reset Password";
    this.emailData.message = this.form.get('resetPass').value;
    this.http.post<any>('/api/reset-password/', this.emailData).subscribe(() => {
      this.sending = false;
      this.openDialog();
    }, (error) => {
      this.sending = false;
      throw error;
    });
  }

}
