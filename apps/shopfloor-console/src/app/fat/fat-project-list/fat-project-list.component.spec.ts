import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { FATProjectListComponent } from './fat-project-list.component';
import { FATProjectService } from '../fat-project.service';

const projects = [
  { project: 'PRJ-A', description: 'Pulse acceptance', progress: 71 },
  { project: 'PRJ-B', description: 'Kiosk refresh', progress: 0 },
  { project: 'PRJ-C', description: 'Old programme', progress: 100 },
];

describe('FATProjectListComponent', () => {
  let http: HttpTestingController;
  let service: FATProjectService;
  let fixture: ComponentFixture<FATProjectListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FATProjectListComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule, NoopAnimationsModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    fixture = TestBed.createComponent(FATProjectListComponent);
    fixture.detectChanges();
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    http.expectOne('/api/fat-project/').flush(projects);
  });

  afterEach(() => http.verify());

  it('has status and progress columns and starts unfiltered', () => {
    expect(fixture.componentInstance.displayedColumns).toEqual(['project', 'description', 'state', 'progress', 'isEdit']);
    expect(service.isLoaded).toBe(true);
    expect(service.datasource.filteredData.length).toBe(3);
  });

  it('counts the projects behind each status button', () => {
    expect(service.countByState(service.datasource.data, 'All')).toBe(3);
    expect(service.countByState(service.datasource.data, 'Not started')).toBe(1);
    expect(service.countByState(service.datasource.data, 'In progress')).toBe(1);
    expect(service.countByState(service.datasource.data, 'Complete')).toBe(1);
  });

  it('narrows by status and combines with the text search', () => {
    service.setStatusFilter('In progress');
    expect(service.datasource.filteredData.map(p => p.project)).toEqual(['PRJ-A']);
    service.setStatusFilter('All');
    service.applyFilter('kiosk');
    expect(service.datasource.filteredData.map(p => p.project)).toEqual(['PRJ-B']);
    service.setStatusFilter('Complete');
    expect(service.datasource.filteredData.length).toBe(0);
  });

  it('keeps a project that is being typed in visible whatever the filters say', () => {
    fixture.componentInstance.table = { renderRows: jest.fn() } as any;
    fixture.componentInstance.addProject();
    service.setStatusFilter('Complete');
    expect(service.datasource.filteredData.some((p: any) => p.isEdit)).toBe(true);
  });

  it('forgets the filters when the list is loaded again', () => {
    service.setStatusFilter('Complete');
    service.applyFilter('old');
    fixture.componentInstance.reload();
    http.expectOne('/api/fat-project/').flush(projects);
    expect(service.statusFilter).toBe('All');
    expect(service.searchText).toBe('');
  });

  it('shows a retry state when the list cannot be loaded', () => {
    fixture.componentInstance.reload();
    expect(service.isLoaded).toBe(false);
    // The error is also re-thrown for the app-wide handler (asynchronously), so only the page state is checked here.
    http.expectOne('/api/fat-project/').flush('boom', { status: 500, statusText: 'Server Error' });
    expect(service.loadError).toBe(true);
    expect(service.isLoaded).toBe(true);
  });
});
