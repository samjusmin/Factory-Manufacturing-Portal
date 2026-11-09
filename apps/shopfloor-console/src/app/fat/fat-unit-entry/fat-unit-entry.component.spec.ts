import { FormBuilder } from '@angular/forms';
import { createUnitEntry, entryPreview, toFatEntries, totalUnits } from './fat-unit-entry.component';
import { unitTypeName } from '../fat-options';

describe('FAT unit entry helpers', () => {
  const filled = (overrides = {}) => ({
    FATlocation: ' Meridian HQ ', FATchecker: 'tenant-a', FATprefix: ' UZ ', FATstart: 12, FATamount: 9,
    UnitType: 'unit-z', FATprinters: null, FAThoneywell: '', FAToptions: [], ...overrides,
  });

  it('previews the run of unit numbers once enough is typed', () => {
    expect(entryPreview(filled())).toBe('Will create 9 units: UZ12 to UZ20');
    expect(entryPreview(filled({ FATamount: 1 }))).toBe('Will create 1 unit: UZ12');
    expect(entryPreview(filled({ FATstart: 0 }))).toBe('Will create 9 units: UZ0 to UZ8');
  });

  it('shows no preview while the prefix, start or amount is missing or unusable', () => {
    expect(entryPreview(filled({ FATprefix: '  ' }))).toBe('');
    expect(entryPreview(filled({ FATstart: null }))).toBe('');
    expect(entryPreview(filled({ FATamount: 0 }))).toBe('');
    expect(entryPreview(filled({ FATamount: null }))).toBe('');
  });

  it('turns form values into what the API expects', () => {
    const [entry] = toFatEntries([filled({ FATprinters: '2', FAToptions: ['FATnfc'] })]);
    expect(entry).toEqual({
      location: 'Meridian HQ', prefix: 'UZ', start: 12, number: 9, checker: 'tenant-a', unit_type: 'unit-z',
      printers: 2, honeywell: 0, options: ['FATnfc'],
    });
  });

  it('treats empty extras as zero and no options', () => {
    const [entry] = toFatEntries([filled({ FATprinters: null, FAThoneywell: undefined, FAToptions: '' })]);
    expect(entry.printers).toBe(0);
    expect(entry.honeywell).toBe(0);
    expect(entry.options).toEqual([]);
  });

  it('adds up the units across entries', () => {
    expect(totalUnits(toFatEntries([filled(), filled({ FATamount: 3 })]))).toBe(12);
  });

  it('validates a new entry', () => {
    const group = createUnitEntry(new FormBuilder());
    expect(group.valid).toBe(false);
    group.patchValue(filled());
    expect(group.valid).toBe(true);

    group.patchValue({ FATamount: 0 });
    expect(group.get('FATamount').valid).toBe(false);
    group.patchValue({ FATamount: 201 });
    expect(group.get('FATamount').valid).toBe(false);
    group.patchValue({ FATamount: 2.5 });
    expect(group.get('FATamount').valid).toBe(false);
    group.patchValue({ FATamount: 5, FATstart: -1 });
    expect(group.get('FATstart').valid).toBe(false);
    group.patchValue({ FATstart: 1, FATprefix: '   ' });
    expect(group.get('FATprefix').valid).toBe(false);
  });

  it('names machine types from the shared list, falling back to the stored value', () => {
    expect(unitTypeName('unit-z-plus')).toBe('Unit Z+');
    expect(unitTypeName('something-new')).toBe('something-new');
  });
});
