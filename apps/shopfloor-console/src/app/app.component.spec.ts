import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('lays the page out as header, sidebar and footer', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('webproject-header')).not.toBeNull();
    expect(compiled.querySelector('main webproject-sidenav')).not.toBeNull();
    expect(compiled.querySelector('webproject-footer')).not.toBeNull();
  });
});
