import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { FATPhaseCommentsComponent } from './fat-phase-comments.component';
import { FATProjectService } from '../fat-project.service';

const notes = [
  { doc_no: 'UZ1', unit_no: 'SN-100', comment: 'Rear panel gap re-checked.\nPasses now.' },
  { doc_no: 'UZ2', unit_no: '', comment: '' },
  { doc_no: 'UZ3', unit_no: 'SN-300', comment: '   ' },
  { doc_no: 'UZ4', unit_no: '', comment: 'Waiting on a replacement display' },
];

describe('FATPhaseCommentsComponent', () => {
  let http: HttpTestingController;
  let service: FATProjectService;
  let component: FATPhaseCommentsComponent;
  let fixture: ComponentFixture<FATPhaseCommentsComponent>;

  const load = (data: any) => {
    http.expectOne('/api/factory-acceptance-test/P1/ph1/getAllUnitComments').flush(data);
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATPhaseCommentsComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, FormsModule, MatDialogModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    jest.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/FAT-phase-comments/P1/ph1');
    fixture = TestBed.createComponent(FATPhaseCommentsComponent);
    component = fixture.componentInstance;
    // The first change detection starts the page (ngOnInit), so it is not called by hand as well.
    fixture.detectChanges();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne('/api/fat-project/P1/ph1').flush([{ name: 'Phase 1' }]);
  });

  afterEach(() => http.verify());

  it('lists only the units that have a note, ignoring blank ones', () => {
    load(notes);
    expect(service.isLoaded).toBe(true);
    expect(component.withNotes.map(u => u.doc_no)).toEqual(['UZ1', 'UZ4']);
    expect(component.totalUnits).toBe(4);
  });

  it('searches the unit, serial number and the note itself', () => {
    load(notes);
    component.search = 'sn-100';
    expect(component.shown.map(u => u.doc_no)).toEqual(['UZ1']);
    component.search = 'DISPLAY';
    expect(component.shown.map(u => u.doc_no)).toEqual(['UZ4']);
    component.search = 'uz4';
    expect(component.shown.map(u => u.doc_no)).toEqual(['UZ4']);
    component.search = 'nothing like this';
    expect(component.shown).toEqual([]);
    component.search = '  ';
    expect(component.shown.length).toBe(2);
  });

  it('shows a card for each note, with the unit as a link and the line breaks kept', () => {
    load(notes);
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.comment-card');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('.comment-unit').textContent.trim()).toBe('UZ1');
    expect(cards[0].querySelector('.comment-unit').getAttribute('href')).toBe('/FAT-unit-cat/P1/ph1/UZ1');
    expect(cards[0].querySelector('.comment-serial').textContent.trim()).toBe('SN-100');
    expect(cards[0].querySelector('.comment-body').textContent).toContain('Passes now.');
  });

  it('says so when no unit has a note', () => {
    load([{ doc_no: 'UZ1', unit_no: '', comment: '' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No unit comments have been added to this phase yet');
    expect(fixture.nativeElement.querySelector('.toolbar')).toBeNull();
  });

  it('says so when the search matches nothing', () => {
    load(notes);
    component.search = 'zzz';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No comments match "zzz"');
  });

  it('offers a retry when the comments cannot be loaded, and forgets the old list', () => {
    load(notes);
    component.reload();
    expect(service.isLoaded).toBe(false);
    expect(component.withNotes).toEqual([]);
    http.expectOne('/api/factory-acceptance-test/P1/ph1/getAllUnitComments').flush('no', { status: 500, statusText: 'Server Error' });
    expect(service.loadError).toBe(true);
    expect(service.isLoaded).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('could not be loaded');
  });
});
