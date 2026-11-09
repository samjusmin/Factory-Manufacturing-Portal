import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  const create = (name: string | null, role: string | null) => {
    localStorage.clear();
    if (name) { localStorage.setItem('name', name); }
    if (role) { localStorage.setItem('role', role); }
    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HeaderComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule, MatMenuModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('shows the account button with the user\'s initial and name when signed in', () => {
    create('alex', 'ADMIN');
    const button = fixture.nativeElement.querySelector('#user');
    expect(button.querySelector('.avatar').textContent.trim()).toBe('A');
    expect(button.querySelector('.user-name').textContent.trim()).toBe('alex');
    expect(component.roleLabel).toBe('Administrator');
  });

  it('shows no account button when nobody is signed in', () => {
    create(null, null);
    expect(fixture.nativeElement.querySelector('#user')).toBeNull();
    expect(component.initial).toBe('');
  });

  it('describes each role in plain words', () => {
    create('sam', 'OPERATOR');
    expect(component.roleLabel).toBe('Operator');
    localStorage.setItem('role', 'EXTUSER');
    expect(component.roleLabel).toBe('External partner');
    localStorage.removeItem('role');
    expect(component.roleLabel).toBe('');
  });
});
