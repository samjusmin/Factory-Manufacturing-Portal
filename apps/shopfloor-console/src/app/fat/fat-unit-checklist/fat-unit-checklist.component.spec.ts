import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { FATUnitChecklistComponent } from './fat-unit-checklist.component';
import { FATProjectService } from '../fat-project.service';

const rows = () => [
  { description: 'Section', reference: 'Heading', status: null, comment: null, checked_by: null, date_checked: null, second_checker: null },
  { description: 'Check A', reference: '', status: 'Complete', comment: 'ok', checked_by: 'Alex', date_checked: '2026-10-01', second_checker: null },
  { description: 'Check B', reference: '', status: 'Incomplete', comment: null, checked_by: 'Sam', date_checked: '2026-10-02', second_checker: null },
  { description: 'Check C', reference: '', status: null, comment: null, checked_by: null, date_checked: null, second_checker: null },
] as any[];

describe('FATUnitChecklistComponent', () => {
  let http: HttpTestingController;
  let service: FATProjectService;
  let component: FATUnitChecklistComponent;
  let fixture: ComponentFixture<FATUnitChecklistComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATUnitChecklistComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    // The page reads project / phase / unit / category from the URL.
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-unit-checklist/P1/ph1/U1/Kiosk%20Common');
    localStorage.setItem('name', 'Alex');
    fixture = TestBed.createComponent(FATUnitChecklistComponent);
    component = fixture.componentInstance;
    component.ngOnInit();
    http.match(() => true).forEach(req => req.flush([]));
    service.checklistsource = new MatTableDataSource<any>(rows());
    // The page reads the list once when it first renders; that is the saved state later edits are compared with.
    component.changedRows;
  });

  it('works out the checks done, ignoring section headings, with N/A counting as done', () => {
    expect(component.checkRows.length).toBe(3);
    expect(component.doneCount).toBe(1);
    service.checklistsource.data[3].status = 'N/A';
    expect(component.doneCount).toBe(2);
    expect(component.donePercent).toBe(67);
  });

  it('has no unsaved changes until a row is edited, and treats empty and missing as the same', () => {
    expect(component.hasUnsavedChanges()).toBe(false);
    service.checklistsource.data[3].comment = '';
    expect(component.hasUnsavedChanges()).toBe(false);
    service.checklistsource.data[3].status = 'Complete';
    expect(component.changedRows.map(r => r.description)).toEqual(['Check C']);
    expect(component.hasUnsavedChanges()).toBe(true);
    service.checklistsource.data[3].status = null;
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('sends the answers, leaves who and when to the server, and refreshes once the server has answered', () => {
    service.checklistsource.data[3].status = 'Complete';
    component.saveChanges();
    expect(component.saveState).toBe('saving');

    const patch = http.expectOne('/api/factory-acceptance-test/');
    const sent = patch.request.body.element.checklist;
    expect(sent[3].status).toBe('Complete');
    expect(sent[3].checked_by).toBeNull();
    patch.flush({});

    expect(component.saveState).toBe('saved');
    // The list is only re-read after the save has finished (that also re-checks the admin flag).
    const reads = http.match(req => req.method === 'GET');
    expect(reads.some(r => decodeURIComponent(r.request.url).indexOf('Kiosk Common') > -1)).toBe(true);
  });

  it('keeps the edits and says so when the save fails', () => {
    service.checklistsource.data[3].status = 'Complete';
    component.saveChanges();
    http.expectOne('/api/factory-acceptance-test/').flush('no', { status: 500, statusText: 'Server Error' });
    expect(component.saveState).toBe('failed');
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  describe('when a serial number is already used', () => {
    function refuse(index: number, reason = 'existing') {
      service.checklistsource.data[index].comment = 'ser-9';
      component.saveChanges();
      http.expectOne('/api/factory-acceptance-test/').flush(
        { statusCode: 400, message: 'These serial numbers are already used: SER-9', duplicates: [{ index, serial: 'SER-9', reason }] },
        { status: 400, statusText: 'Bad Request' });
    }

    it('keeps what was typed and flags the row, with nothing reloaded', () => {
      refuse(3);
      const row = service.checklistsource.data[3];
      expect(row.comment).toBe('ser-9');
      expect(component.serialError(row)).toBe('SER-9 is already used on another unit.');
      expect(component.serialError(service.checklistsource.data[1])).toBeNull();
      expect(component.saveState).toBe('');
      http.expectNone(() => true);
    });

    it('still counts the row as unsaved, so it can be corrected and saved again', () => {
      refuse(3);
      expect(component.hasUnsavedChanges()).toBe(true);
      expect(component.canSave).toBe(true);
    });

    it('words a repeat on the same form differently', () => {
      refuse(3, 'form');
      expect(component.serialError(service.checklistsource.data[3])).toBe('SER-9 is entered more than once on this checklist.');
    });

    it('clears the message when the value changes, and on the next save', () => {
      refuse(3);
      const row = service.checklistsource.data[3];
      component.clearSerialError(row);
      expect(component.serialError(row)).toBeNull();
      expect(component.serialErrors.size).toBe(0);

      refuse(3);
      component.saveChanges();
      expect(component.serialErrors.size).toBe(0);
      http.expectOne('/api/factory-acceptance-test/').flush({});
      http.match(() => true).forEach(req => req.flush([]));
    });
  });

  it('does not send a second save while one is running', () => {
    service.checklistsource.data[3].status = 'Complete';
    component.saveChanges();
    component.saveChanges();
    http.expectOne('/api/factory-acceptance-test/');
  });

  it('groups the checks under their headings', () => {
    const sections = component.sections;
    expect(sections.length).toBe(1);
    expect(sections[0].heading.description).toBe('Section');
    expect(sections[0].rows.map(r => r.description)).toEqual(['Check A', 'Check B', 'Check C']);
    // The grouping is rebuilt only when a new list arrives, so typing never rebuilds the page.
    expect(component.sections).toBe(sections);
  });

  it('offers bulk actions only for unanswered checks, never overwriting an explicit answer', () => {
    expect(component.bulkAllowed).toBe(true);
    expect(component.allUnchecked.map(r => r.description)).toEqual(['Check C']);

    const dialog = { open: jest.fn().mockReturnValue({ afterClosed: () => of(true) }) };
    (component as any).dialog = dialog;
    component.markComplete(component.checkRows, 'Kiosk Common');
    expect(dialog.open).toHaveBeenCalled();
    expect(service.checklistsource.data[3].status).toBe('Complete');
    expect(service.checklistsource.data[2].status).toBe('Incomplete');   // a failed check is left alone
    expect(component.changedRows.map(r => r.description)).toEqual(['Check C']);
  });

  it('does nothing when the bulk action is declined', () => {
    (component as any).dialog = { open: () => ({ afterClosed: () => of(false) }) };
    component.markComplete(component.checkRows, 'Kiosk Common');
    expect(service.checklistsource.data[3].status).toBeNull();
  });

  it('takes an answer back when the chosen one is clicked again', () => {
    const row = service.checklistsource.data[3];
    component.chooseStatus(row, 'N/A');
    expect(row.status).toBe('N/A');
    // A different answer replaces it.
    component.chooseStatus(row, 'Complete');
    expect(row.status).toBe('Complete');
    // The same answer again clears it.
    component.chooseStatus(row, 'Complete');
    expect(row.status).toBeNull();
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('unticks the radio button once the click has been handled', () => {
    jest.useFakeTimers();
    const row = service.checklistsource.data[1];   // Complete
    const input = { checked: true } as HTMLInputElement;
    component.chooseStatus(row, 'Complete', { target: input } as any);
    expect(row.status).toBeNull();
    jest.runAllTimers();
    expect(input.checked).toBe(false);
    jest.useRealTimers();
  });

  it('saves a cleared answer', () => {
    const row = service.checklistsource.data[1];   // Complete, checked by Alex
    component.chooseStatus(row, 'Complete');
    expect(component.changedRows.map(r => r.description)).toEqual(['Check A']);
    component.saveChanges();
    const patch = http.expectOne('/api/factory-acceptance-test/');
    expect(patch.request.body.element.checklist[1].status).toBeNull();
    patch.flush({});
  });

  it('flags a blank unit name beside the row, without an error dialog', () => {
    service.checklistsource.data[1].status = 'Incomplete';
    component.saveChanges();
    http.expectOne('/api/factory-acceptance-test/').flush(
      { message: 'Enter the unit name', duplicates: [{ index: 1, serial: '', reason: 'blank' }] },
      { status: 400, statusText: 'Bad Request' });
    expect(component.saveState).toBe('');
    expect(component.serialError(service.checklistsource.data[1])).toContain('Enter the unit name');
  });

  describe('when someone else saves the same checklist first', () => {
    const isReload = (req: any) => req.method === 'GET' && decodeURIComponent(req.url).indexOf('Kiosk Common') > -1;
    // What the server now holds: Check B was changed by someone else (and Check C too, when `theirC` is given).
    const theirRows = (theirC: string | null = null) => {
      const r = rows();
      r[2].status = 'Complete';
      r[2].checked_by = 'Sam';
      r[3].status = theirC;
      return r;
    };
    const conflict = (theirC: string | null = null) => {
      component.saveChanges();
      http.expectOne('/api/factory-acceptance-test/').flush('changed', { status: 409, statusText: 'Conflict' });
      http.match(isReload).forEach(req => req.flush(theirRows(theirC), { headers: { 'X-Checklist-Version': '3' } }));
    };

    beforeEach(() => {
      service.checklistVersion = 2;
    });

    it('sends the version it loaded', () => {
      service.checklistsource.data[3].status = 'Complete';
      component.saveChanges();
      const patch = http.expectOne('/api/factory-acceptance-test/');
      expect(patch.request.body.element.version).toBe(2);
      patch.flush({});
      http.match(() => true);
    });

    it('keeps the user\'s edits, shows the other person\'s, and saves on top of their version', () => {
      service.checklistsource.data[3].status = 'Complete';   // mine: Check C
      conflict();

      expect(component.saveState).toBe('');
      expect(service.checklistVersion).toBe(3);
      expect(service.checklistsource.data[2].status).toBe('Complete');      // theirs: Check B
      expect(service.checklistsource.data[2].checked_by).toBe('Sam');
      expect(service.checklistsource.data[3].status).toBe('Complete');      // mine kept
      expect(component.mergeNotice).toContain('Someone else saved this checklist');
      expect(component.mergeNotice).toContain('1 check now shows their change');
      expect(component.conflicts).toEqual([]);
      // Only the user's own change is left to save.
      expect(component.changedRows.map(r => r.description)).toEqual(['Check C']);
      expect(component.canSave).toBe(true);

      component.saveChanges();
      expect(http.expectOne('/api/factory-acceptance-test/').request.body.element.version).toBe(3);
      http.match(() => true);
    });

    it('does not save until a row changed by both people has been settled', () => {
      service.checklistsource.data[3].status = 'Complete';   // mine
      conflict('N/A');                                         // theirs: a different answer for the same check

      expect(component.conflicts.length).toBe(1);
      expect(component.unresolvedCount).toBe(1);
      expect(component.conflictFor(service.checklistsource.data[3])).not.toBeNull();
      expect(component.canSave).toBe(false);
      component.saveChanges();
      http.expectNone('/api/factory-acceptance-test/');

      component.keepMine(component.conflicts[0]);
      expect(component.unresolvedCount).toBe(0);
      expect(service.checklistsource.data[3].status).toBe('Complete');
      expect(component.canSave).toBe(true);
    });

    it('can take the other person\'s answer instead, leaving nothing to save', () => {
      service.checklistsource.data[3].status = 'Complete';
      conflict('N/A');
      component.useTheirs(component.conflicts[0]);
      expect(service.checklistsource.data[3].status).toBe('N/A');
      expect(component.unresolvedCount).toBe(0);
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('reloads and says so when the checklist no longer lines up', () => {
      service.checklistsource.data[3].status = 'Complete';
      component.saveChanges();
      http.expectOne('/api/factory-acceptance-test/').flush('changed', { status: 409, statusText: 'Conflict' });
      http.match(isReload).forEach(req => req.flush(rows().slice(0, 3), { headers: { 'X-Checklist-Version': '5' } }));
      expect(service.checklistsource.data.length).toBe(3);
      expect(service.checklistVersion).toBe(5);
      expect(component.mergeNotice).toContain('could not be kept');
      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('still reports other failed saves as failed', () => {
      service.checklistsource.data[3].status = 'Complete';
      component.saveChanges();
      http.expectOne('/api/factory-acceptance-test/').flush('no', { status: 500, statusText: 'Server Error' });
      expect(component.saveState).toBe('failed');
      expect(component.mergeNotice).toBe('');
    });
  });

  it('keeps bulk actions away from serial number lists', () => {
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-unit-checklist/P1/ph1/U1/Serial%20Numbers');
    expect(component.bulkAllowed).toBe(false);
  });
});
