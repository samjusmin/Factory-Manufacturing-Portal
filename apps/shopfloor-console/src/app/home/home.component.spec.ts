import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { IDashboardSummary } from '@webproject/data';
import { HomeComponent } from './home.component';
import { HomeService } from './home.service';

const summary: IDashboardSummary = {
  production: { open: 12, inProgress: 3, overdue: 2 },
  receiving: { open: 4, openLines: 9, overdue: 1, dueThisWeek: 2 },
  orders: { open: 5, openLines: 11, overdue: 2, dueThisWeek: 3 },
  inventory: { skus: 200, lowStock: 7, outOfStock: 2 },
  fat: { total: 4, inProgress: 1, complete: 2, attention: { units: 3, failedChecks: 5 } },
  training: { people: 10, expired: 4, dueSoon: 6, missing: 9 },
};

describe('HomeComponent', () => {
  let getSummary: jest.Mock;

  // The areas a person holds decide which cards show, so each test says which it has.
  async function create(role: string, areas: string[], locations: string[] = ['Partner C']): Promise<ComponentFixture<HomeComponent>> {
    localStorage.setItem('role', role);
    localStorage.setItem('areas', JSON.stringify(areas));
    localStorage.setItem('locations', JSON.stringify(locations));
    localStorage.setItem('name', 'Sam');
    await TestBed.configureTestingModule({
      declarations: [HomeComponent],
      providers: [{ provide: HomeService, useValue: { getSummary } }],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    getSummary = jest.fn().mockReturnValue(of(summary));
  });

  afterEach(() => localStorage.clear());

  it('shows warehouse figures and FAT for an operator who holds those areas, without training', async () => {
    const component = (await create('OPERATOR', ['warehouse', 'config', 'fat'])).componentInstance;
    expect(component.warehouseCards.map(c => c.title)).toEqual(['Production', 'Orders', 'Receiving', 'Inventory']);
    expect(component.warehouseCards[0].value).toBe(12);
    expect(component.warehouseCards[3].warn).toBe(true);
    const quick = component.quickCards.map(c => c.title);
    expect(quick).toEqual(['Config', 'FAT']);
    // A non-admin's Config card goes straight to their own location.
    expect(component.quickCards[0].link).toEqual(['/config-categories', 'Partner C']);
  });

  it('gives Orders and Receiving different figures: orders tracked and overdue, receiving due this week and overdue', async () => {
    const component = (await create('OPERATOR', ['warehouse'])).componentInstance;
    const orders = component.warehouseCards.find(c => c.title === 'Orders');
    const receiving = component.warehouseCards.find(c => c.title === 'Receiving');
    expect(orders.value).toBe(5);
    expect(orders.meta).toBe('2 overdue · 11 open lines');
    expect(orders.warn).toBe(true);
    expect(receiving.value).toBe(4);
    expect(receiving.meta).toBe('2 due this week · 1 overdue');
    expect(receiving.warn).toBe(true);
  });

  it('flags the FAT card when units have failed checks, and stays calm when none do', async () => {
    const fat = (await create('OPERATOR', ['fat'])).componentInstance.quickCards.find(c => c.title === 'FAT');
    expect(fat.meta).toBe('2 complete, 1 in progress · 3 units with failed checks');
    expect(fat.warn).toBe(true);

    TestBed.resetTestingModule();
    getSummary.mockReturnValue(of({ ...summary, fat: { ...summary.fat, attention: { units: 0, failedChecks: 0 } } }));
    const calm = (await create('OPERATOR', ['fat'])).componentInstance.quickCards.find(c => c.title === 'FAT');
    expect(calm.meta).toBe('2 complete, 1 in progress');
    expect(calm.warn).toBe(false);
  });

  it('shows every card for an admin, with training counting the expired and not-done modules', async () => {
    const component = (await create('ADMIN', [])).componentInstance;
    expect(component.warehouseCards).toHaveLength(4);
    expect(component.quickCards.map(c => c.title)).toEqual(['Config', 'FAT', 'Training']);
    expect(component.quickCards[0].link).toEqual(['/config-admin']);
    const training = component.quickCards[2];
    expect(training.value).toBe(13);
    expect(training.meta).toBe('4 expired · 9 not done · 6 due soon');
    expect(training.warn).toBe(true);
  });

  it('says so, without a warning, when all required training is in date', async () => {
    getSummary.mockReturnValue(of({ ...summary, training: { people: 1, expired: 0, dueSoon: 0, missing: 0 } }));
    const training = (await create('ADMIN', [])).componentInstance.quickCards.find(c => c.title === 'Training');
    expect(training.value).toBe(0);
    expect(training.meta).toBe('All required training is in date for 1 person');
    expect(training.warn).toBe(false);
  });

  it('shows only the areas a person holds', async () => {
    const fatOnly = (await create('EXTUSER', ['fat'])).componentInstance;
    expect(fatOnly.warehouseCards).toEqual([]);
    expect(fatOnly.quickCards.map(c => c.title)).toEqual(['FAT']);

    TestBed.resetTestingModule();
    getSummary.mockReturnValue(of({ fat: summary.fat }));
    const warehouseOnly = (await create('OPERATOR', ['warehouse'])).componentInstance;
    expect(warehouseOnly.quickCards).toEqual([]);
  });

  it('has no cards for a person who holds no area', async () => {
    getSummary.mockReturnValue(of({}));
    const component = (await create('OPERATOR', [])).componentInstance;
    expect(component.warehouseCards).toEqual([]);
    expect(component.quickCards).toEqual([]);
  });

  it('keeps the launcher and offers a retry when the summary fails', async () => {
    getSummary.mockReturnValue(throwError({ status: 500 }));
    const component = (await create('OPERATOR', ['warehouse', 'fat'])).componentInstance;
    expect(component.failed).toBe(true);
    expect(component.warehouseCards).toHaveLength(4);
    expect(component.warehouseCards[0].value).toBeNull();
  });
});
