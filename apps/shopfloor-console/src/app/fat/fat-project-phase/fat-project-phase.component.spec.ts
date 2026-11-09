import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { FATProjectPhaseComponent } from './fat-project-phase.component';

describe('FATProjectPhaseComponent', () => {
  let component: FATProjectPhaseComponent;
  let fixture: ComponentFixture<FATProjectPhaseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FATProjectPhaseComponent ],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    // The page reads which record to show from the address.
    Object.defineProperty(TestBed.inject(Router), 'url', { get: () => '/FAT-project-phase/PRJ-A' });
    fixture = TestBed.createComponent(FATProjectPhaseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
