import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { RouterTestingModule } from '@angular/router/testing';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let http: HttpTestingController;
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [HttpClientTestingModule, ReactiveFormsModule, RouterTestingModule, MatDialogModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const text = () => fixture.nativeElement.textContent as string;

  it('shows the sign-in form with a reset link well apart from the Login button', () => {
    expect(fixture.nativeElement.querySelector('#username')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.submit').textContent).toContain('Login');
    // The reset link is its own row under the form, not a button beside Login.
    const link = fixture.nativeElement.querySelector('.reset-row a');
    expect(link.getAttribute('href')).toBe('/reset-password');
    expect(fixture.nativeElement.querySelector('form').contains(link)).toBe(false);
  });

  it('asks for the missing fields instead of sending anything', () => {
    component.onSubmit();
    fixture.detectChanges();
    http.expectNone('/api/auth/login/');
    expect(text()).toContain('Enter your username');
    expect(text()).toContain('Enter your password');
  });

  it('fills in a demo account when it is chosen', () => {
    component.fillDemo('operator');
    expect(component.form.value).toEqual({ username: 'operator', password: 'operator123' });
  });

  it('can show and hide the password', () => {
    const input = () => fixture.nativeElement.querySelector('#password') as HTMLInputElement;
    expect(input().type).toBe('password');
    component.showPassword = true;
    fixture.detectChanges();
    expect(input().type).toBe('text');
  });

  it('says when the sign-in details are wrong, and stops saying so once the user types again', () => {
    component.fillDemo('admin');
    component.onSubmit();
    expect(component.loading).toBe(true);
    http.expectOne('/api/auth/login/').flush('no', { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();
    expect(component.loading).toBe(false);
    expect(text()).toContain('do not match');

    component.form.patchValue({ password: 'other' });
    fixture.detectChanges();
    expect(text()).not.toContain('do not match');
  });
});
