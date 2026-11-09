import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { ReceivingDetailTableComponent } from './receiving-detail-table.component';

describe('ReceivingDetailTableComponent', () => {
  let http: HttpTestingController;

  async function create(data: any): Promise<ComponentFixture<ReceivingDetailTableComponent>> {
    await TestBed.configureTestingModule({
      declarations: [ReceivingDetailTableComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data, paramMap: convertToParamMap({ poId: 'PO-24001' }) } } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReceivingDetailTableComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => http.verify());

  it('Receiving detail loads the order with quantity entry', async () => {
    const component = (await create({})).componentInstance;
    http.expectOne('/api/purchase-order/PO-24001').flush([]);
    expect(component.readOnly).toBe(false);
    expect(component.detailColumns).toContain('qty_to_receive');
  });

  it('the Orders view is read-only: it uses the order endpoint and has no quantity-entry column', async () => {
    const component = (await create({ readOnly: true })).componentInstance;
    http.expectOne('/api/purchase-order/orders/PO-24001').flush([]);
    expect(component.readOnly).toBe(true);
    expect(component.detailColumns).not.toContain('qty_to_receive');
    expect(component.detailColumns).toContain('qty_remaining');
  });

  it('no longer lists the never-populated shipped quantity', async () => {
    const component = (await create({})).componentInstance;
    http.expectOne('/api/purchase-order/PO-24001').flush([]);
    expect(component.detailColumns).not.toContain('qty_shipped');
  });
});
