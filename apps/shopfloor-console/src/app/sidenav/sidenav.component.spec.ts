import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { SidenavComponent } from './sidenav.component';

describe('SidenavComponent', () => {
  const create = (name: string | null, role = 'OPERATOR', areas: string[] = []) => {
    localStorage.clear();
    if (name) {
      localStorage.setItem('name', name);
      localStorage.setItem('role', role);
      localStorage.setItem('areas', JSON.stringify(areas));
      localStorage.setItem('locations', JSON.stringify(['Partner C']));
    }
    const fixture = TestBed.createComponent(SidenavComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SidenavComponent],
      imports: [RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();
  });

  afterEach(() => localStorage.clear());

  it('hides the whole main menu when nobody is signed in', () => {
    const el = create(null);
    expect(el.querySelector('mat-sidenav')).toBeNull();
    expect(el.textContent).not.toContain('Main Menu');
    // The page itself is still shown.
    expect(el.querySelector('router-outlet')).not.toBeNull();
  });

  it('shows the menu once someone is signed in', () => {
    const el = create('sam');
    expect(el.querySelector('mat-sidenav')).not.toBeNull();
    expect(el.textContent).toContain('Main Menu');
    expect(el.textContent).toContain('Home');
  });

  const links = (el: HTMLElement) => Array.from(el.querySelectorAll('.nav-link')).map(a => (a.textContent || '').trim());

  it('shows Warehouse, Config and FAT only for the areas a person holds', () => {
    expect(links(create('sam', 'OPERATOR', ['warehouse', 'config']))).toEqual(['Home', 'Warehouse', 'Config']);
    expect(links(create('jo', 'EXTUSER', ['fat']))).toEqual(['Home', 'FAT']);
    expect(links(create('kim', 'OPERATOR', ['warehouse', 'fat']))).toEqual(['Home', 'Warehouse', 'FAT']);
  });

  it('shows only Home to a person with no area', () => {
    expect(links(create('kim', 'OPERATOR', []))).toEqual(['Home']);
  });

  it('shows an admin everything, including Training, whatever areas are listed', () => {
    expect(links(create('alex', 'ADMIN', []))).toEqual(['Home', 'Warehouse', 'Config', 'FAT', 'Training']);
  });

  it('does not offer Training to anyone but an admin', () => {
    expect(links(create('sam', 'OPERATOR', ['warehouse', 'config', 'fat']))).not.toContain('Training');
  });
});
