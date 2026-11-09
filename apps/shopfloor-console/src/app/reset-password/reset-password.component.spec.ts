import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let http: HttpTestingController;
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResetPasswordComponent],
      imports: [HttpClientTestingModule, ReactiveFormsModule, RouterTestingModule, MatDialogModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('has a back arrow and a Cancel button that both lead back to the sign-in page', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.page-header a.back').getAttribute('href')).toBe('/login');
    const cancel = Array.from(el.querySelectorAll('.actions a')).find(a => a.textContent.trim() === 'Cancel');
    expect(cancel.getAttribute('href')).toBe('/login');
  });

  it('will not send until the email address is valid', () => {
    component.form.patchValue({ resetPass: 'not an email' });
    expect(component.form.invalid).toBe(true);
    component.sendEmail();
    http.expectNone('/api/reset-password/');

    component.form.patchValue({ resetPass: 'sam@example.com' });
    expect(component.form.valid).toBe(true);
  });

  it('sends the request once, then confirms and returns to the sign-in page', () => {
    const dialog = { afterClosed: () => of(true) };
    jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue(dialog as any);
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    component.form.patchValue({ resetPass: 'sam@example.com' });
    component.sendEmail();
    component.sendEmail();   // a second press while it is sending does nothing
    const req = http.expectOne('/api/reset-password/');
    expect(req.request.body).toEqual({ subject: 'Reset Password', message: 'sam@example.com' });
    expect(component.sending).toBe(true);
    req.flush({});

    expect(component.sending).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
