import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialogModule } from '@angular/material/dialog';

import { FATProjectService } from './fat-project.service';

describe('FATProjectService admin check', () => {
  let http: HttpTestingController;
  let service: FATProjectService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(FATProjectService);
    localStorage.setItem('token', 'token-1');
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('token');
  });

  it('asks the server once, then answers straight away for the same sign-in', async () => {
    await service.checkIfAdmin();
    expect(service.isAdmin).toBe(false);
    http.expectOne('/api/fat-project/adminCheck').flush(true);
    expect(service.isAdmin).toBe(true);

    // Another page, same sign-in: admin controls stay shown, with no new request.
    service.isAdmin = false;
    await service.checkIfAdmin();
    expect(service.isAdmin).toBe(true);
    http.expectNone('/api/fat-project/adminCheck');
  });

  it('asks again after a new sign-in, hiding admin controls until it is answered', async () => {
    await service.checkIfAdmin();
    http.expectOne('/api/fat-project/adminCheck').flush(true);

    localStorage.setItem('token', 'token-2');
    await service.checkIfAdmin();
    expect(service.isAdmin).toBe(false);
    http.expectOne('/api/fat-project/adminCheck').flush(false);
    expect(service.isAdmin).toBe(false);
    expect(service.showError).toBe(true);
  });

  it('remembers that a user is not an admin', async () => {
    await service.checkIfAdmin();
    http.expectOne('/api/fat-project/adminCheck').flush(false);
    service.showError = false;
    await service.checkIfAdmin();
    expect(service.isAdmin).toBe(false);
    expect(service.showError).toBe(true);
    http.expectNone('/api/fat-project/adminCheck');
  });
});
