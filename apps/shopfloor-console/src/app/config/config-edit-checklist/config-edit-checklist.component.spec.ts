import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { ConfigService } from '../config.service';
import { ConfigEditChecklistComponent } from './config-edit-checklist.component';

function build() {
  const service: any = {
    checkIfAdmin: jest.fn(),
    goBack: jest.fn(),
    getCatalogueType: jest.fn(() => of({ category: 'PC', name: 'Bio PC', checklist: [{ description: 'One', reference: null }] })),
    saveChecklist: jest.fn(() => of({})),
  };
  const route: any = { snapshot: { paramMap: { get: () => 'Bio PC' } } };
  const component = new ConfigEditChecklistComponent(service, route, {} as any, {} as any, { open: jest.fn() } as any);
  (component as any).table = { renderRows: jest.fn() };
  component.ngOnInit();
  return { component, service };
}

describe('ConfigEditChecklistComponent', () => {
  it('has nothing unsaved until a row changes, and again after a save', () => {
    const { component, service } = build();
    expect(component.hasUnsavedChanges()).toBe(false);
    component.addChecklist();
    expect(component.hasUnsavedChanges()).toBe(true);
    component.saveChanges();
    expect(service.saveChecklist).toHaveBeenCalled();
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('leaves through the router, so the leave warning applies however the user leaves', () => {
    const { component, service } = build();
    component.markDirty();
    component.goBack();
    expect(service.goBack).toHaveBeenCalled();
  });

  it('warns before the tab is closed only when something is unsaved', () => {
    const { component } = build();
    const clean: any = { preventDefault: jest.fn() };
    component.warnBeforeUnload(clean);
    expect(clean.preventDefault).not.toHaveBeenCalled();
    component.markDirty();
    const dirty: any = { preventDefault: jest.fn() };
    component.warnBeforeUnload(dirty);
    expect(dirty.preventDefault).toHaveBeenCalled();
  });

  it('draws a section row, both a new one and one already saved', async () => {
    const service: any = {
      isAdmin: true,
      checkIfAdmin() { this.isAdmin = true; },
      getCatalogueType: () => of({ category: 'PC', name: 'Bio PC', checklist: [{ description: 'Saved section', reference: 'Heading' }] }),
    };
    await TestBed.configureTestingModule({
      declarations: [ConfigEditChecklistComponent],
      imports: [FormsModule, MatInputModule, MatTableModule, NoopAnimationsModule],
      providers: [
        { provide: ConfigService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'Bio PC' } } } },
        { provide: Router, useValue: {} },
        { provide: MatDialog, useValue: {} },
        { provide: MatSnackBar, useValue: {} },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    const fixture = TestBed.createComponent(ConfigEditChecklistComponent);
    fixture.detectChanges();
    fixture.detectChanges();
    fixture.componentInstance.addHeading();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(fixture.nativeElement.querySelectorAll('tr.heading-row').length).toBe(2);
    expect(text).toContain('Section heading');
    expect(fixture.nativeElement.querySelectorAll('input[aria-label="Reference"]').length).toBe(0);
  });
});
