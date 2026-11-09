import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SKIP_LOADING_HEADER } from '../error/http-loading.interceptor';
import { TrainingService } from './training.service';

describe('TrainingService', () => {
  let service: TrainingService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('token', 'abc');
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(TrainingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('loads the locations with the signed-in token, showing the loading dialog', () => {
    service.locations().subscribe();
    const req = http.expectOne('/api/train-reg/locations');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    expect(req.request.headers.has(SKIP_LOADING_HEADER)).toBe(false);
    req.flush([]);
  });

  it('encodes the username in the address', () => {
    service.user('a b/c').subscribe();
    http.expectOne('/api/train-reg/users/a%20b%2Fc').flush({});
  });

  it('records a completion quietly', () => {
    service.record('sam', 'Picking/Packing', '2026-10-30').subscribe();
    const req = http.expectOne('/api/train-reg/users/sam/completions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ module: 'Picking/Packing', date: '2026-10-30' });
    expect(req.request.headers.has(SKIP_LOADING_HEADER)).toBe(true);
    req.flush({});
  });

  it('clears a completion, sending the module as a query value because it can contain a slash', () => {
    service.clear('sam', 'Picking/Packing').subscribe();
    const req = http.expectOne(r => r.url === '/api/train-reg/users/sam/completions');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('module')).toBe('Picking/Packing');
    req.flush({});
  });

  it('saves roles', () => {
    service.setAreas('sam', ['warehouse', 'fat']).subscribe();
    const req = http.expectOne('/api/train-reg/users/sam/areas');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ areas: ['warehouse', 'fat'] });
    req.flush({});
  });
});
