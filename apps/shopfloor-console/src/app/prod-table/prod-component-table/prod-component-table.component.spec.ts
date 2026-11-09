import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ProdComponentTableComponent } from './prod-component-table.component';

describe('ProdComponentTableComponent', () => {
  let component: ProdComponentTableComponent;
  let fixture: ComponentFixture<ProdComponentTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ProdComponentTableComponent ],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    })
    .compileComponents();
  });

  beforeEach(() => {
    // The page reads which record to show from the address.
    Object.defineProperty(TestBed.inject(Router), 'url', { get: () => '/production/MRP-1/10' });
    fixture = TestBed.createComponent(ProdComponentTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
