import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';
import { FATEditCategoriesComponent } from './fat-edit-cat.component';

describe('FATEditCategoriesComponent', () => {
  let component: FATEditCategoriesComponent;
  let fixture: ComponentFixture<FATEditCategoriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FATEditCategoriesComponent ],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule, NoopAnimationsModule, ReactiveFormsModule],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    // The page reads which record to show from the address.
    Object.defineProperty(TestBed.inject(Router), 'url', { get: () => '/FAT-edit-cat' });
    fixture = TestBed.createComponent(FATEditCategoriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
