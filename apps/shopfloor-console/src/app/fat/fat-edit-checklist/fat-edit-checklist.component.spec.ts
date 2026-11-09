import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { FATEditChecklistComponent } from './fat-edit-checklist.component';

const template = [
  { description: 'Check A', reference: 'Ref A' },
  { description: 'Check B', reference: null },
];

describe('FATEditChecklistComponent', () => {
  let http: HttpTestingController;
  let component: FATEditChecklistComponent;
  let fixture: ComponentFixture<FATEditChecklistComponent>;

  const templateUrl = (r: { url: string }) => decodeURIComponent(r.url) === '/api/factory-acceptance-test/Kiosk Common';
  const answerDialog = (confirmed: boolean) => {
    const dialog = { open: jest.fn().mockReturnValue({ afterClosed: () => of(confirmed) }) };
    (component as any).dialog = dialog;
    return dialog;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATEditChecklistComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule, MatDialogModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-edit-checklist/Kiosk%20Common');
    fixture = TestBed.createComponent(FATEditChecklistComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne(templateUrl).flush(template);
  });

  afterEach(() => http.verify());

  it('loads the template rows and starts with nothing to save', () => {
    expect(component.getCategory()).toBe('Kiosk Common');
    expect(component.rows.map(r => r.description)).toEqual(['Check A', 'Check B']);
    expect(component.rows[1].reference).toBe('');
    expect(component.hasUnsavedChanges()).toBe(false);
    expect(component.canSave).toBe(false);
  });

  it('notices edits, new rows and removals, and marks the rows that changed', () => {
    component.rows[0].description = 'Check A (updated)';
    expect(component.hasUnsavedChanges()).toBe(true);
    expect(component.isChanged(component.rows[0])).toBe(true);
    expect(component.isChanged(component.rows[1])).toBe(false);

    component.rows[0].description = 'Check A';
    expect(component.hasUnsavedChanges()).toBe(false);

    component.addRow();
    expect(component.isChanged(component.rows[2])).toBe(true);
    component.rows[2].description = 'Check C';
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('cannot save while a row has no description', () => {
    component.addRow();
    expect(component.blankRows).toBe(1);
    expect(component.canSave).toBe(false);
    component.rows[2].description = '   ';
    expect(component.canSave).toBe(false);
    component.rows[2].description = 'Check C';
    expect(component.canSave).toBe(true);
  });

  it('asks before removing a row that has text, and removes it only when confirmed', () => {
    const dialog = answerDialog(false);
    component.removeRow(component.rows[0]);
    expect(dialog.open).toHaveBeenCalled();
    expect(component.rows.length).toBe(2);

    answerDialog(true);
    component.removeRow(component.rows[0]);
    expect(component.rows.map(r => r.description)).toEqual(['Check B']);
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('removes a row that is still empty without asking', () => {
    const dialog = answerDialog(true);
    component.addRow();
    component.removeRow(component.rows[2]);
    expect(dialog.open).not.toHaveBeenCalled();
    expect(component.rows.length).toBe(2);
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('saves the trimmed rows and then has nothing left to save', () => {
    component.rows[0].description = '  Check A (updated)  ';
    component.saveChanges();
    expect(component.saveState).toBe('saving');

    const req = http.expectOne('/api/factory-acceptance-test/');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.type).toBe('edit');
    expect(req.request.body.element.category).toBe('Kiosk Common');
    expect(req.request.body.element.checklists.map(c => [c.description, c.reference])).toEqual([['Check A (updated)', 'Ref A'], ['Check B', '']]);
    req.flush({});

    expect(component.saveState).toBe('saved');
    expect(component.hasUnsavedChanges()).toBe(false);
    expect(component.rows[0].description).toBe('Check A (updated)');
  });

  it('keeps the edits and says so when the save fails', () => {
    component.rows[1].description = 'Check B (updated)';
    component.saveChanges();
    http.expectOne('/api/factory-acceptance-test/').flush('no', { status: 500, statusText: 'Server Error' });
    expect(component.saveState).toBe('failed');
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('does not send a second save while one is running', () => {
    component.rows[0].description = 'Changed';
    component.saveChanges();
    component.saveChanges();
    http.expectOne('/api/factory-acceptance-test/');
  });
});
