import { LocationProjectsComponent } from './location-projects.component';

function build(projects: string[] | undefined) {
  const component = new LocationProjectsComponent();
  component.locationData = { location: 'Meridian HQ', projects };
  component.ngOnInit();
  return component;
}

describe('LocationProjectsComponent', () => {
  it('lists the location\'s own projects, never STOCK among them', () => {
    expect(build(['PRJ-ALPHA', 'stock', ' prj-bravo ']).projects).toEqual(['PRJ-ALPHA', 'PRJ-BRAVO']);
    expect(build(undefined).projects).toEqual([]);
  });

  it('adds a project code in upper case and clears the box', () => {
    const component = build([]);
    component.newCode = ' prj  new ';
    component.add();
    expect(component.projects).toEqual(['PRJ NEW']);
    expect(component.newCode).toBe('');
    expect(component.message).toBe('');
  });

  it('does not add STOCK (it is built in) or a code twice, and says so', () => {
    const component = build(['PRJ-A']);
    component.newCode = 'Stock';
    component.add();
    expect(component.message).toContain('built in');
    component.newCode = 'prj-a';
    component.add();
    expect(component.message).toBe('PRJ-A is already a project here.');
    expect(component.projects).toEqual(['PRJ-A']);
  });

  it('ignores an empty code', () => {
    const component = build([]);
    component.newCode = '   ';
    component.add();
    expect(component.projects).toEqual([]);
    expect(component.message).toBe('');
  });

  it('removes a project', () => {
    const component = build(['PRJ-A', 'PRJ-B']);
    component.remove('PRJ-A');
    expect(component.projects).toEqual(['PRJ-B']);
  });

  it('reports what it holds, counting a code still being typed', () => {
    const component = build(['PRJ-A']);
    component.newCode = 'prj-b';
    expect(component.getFormattedProjects()).toEqual({ location: 'Meridian HQ', projects: ['PRJ-A', 'PRJ-B'] });
  });
});
