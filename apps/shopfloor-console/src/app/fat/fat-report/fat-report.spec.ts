import { CSV_COLUMNS, buildReport, csvCell, formatReportDate, reportCsv, reportFileName } from './fat-report';

const docs = [
  {
    doc_no: 'UZ1', unit_no: 'SN-1', project: 'PRJ-A', phase: 'ph1', unit_type: 'unit-z', location: 'HQ', progress: 50,
    category: [
      {
        name: 'Kiosk Common', progress: 50,
        checklists: [
          { description: 'Mechanical', reference: 'Heading', status: null },
          { description: 'Label fitted', reference: 'Fit the label', status: 'Complete', comment: 'ok', checked_by: 'Alex', date_checked: '2026-11-03' },
          { description: 'Latch, rear', status: 'Incomplete', comment: 'Sticks "badly"', checked_by: 'Sam', second_checker: 'Jo', date_checked: '2026-11-02T10:15:00.000Z' },
          { description: 'Software', reference: 'Heading', status: null },
          { description: 'Image', status: null, date_checked: '2026-01-01' },
          { description: 'Printer', status: 'N/A', comment: '=SUM(A1)' },
        ],
      },
    ],
  },
  { doc_no: 'UZ2', unit_no: '', project: 'PRJ-A', phase: 'ph1', unit_type: 'unit-z', location: 'HQ', progress: 100, category: [{ name: 'Bios', progress: 100, checklists: [{ description: 'Version', status: 'Complete' }] }] },
];

describe('buildReport', () => {
  const report = buildReport(docs, { phaseName: 'Phase 1', generatedBy: 'Alex', now: new Date(2026, 10, 3, 14, 5) });

  it('names the report and the units in it', () => {
    expect(report.title).toBe('PRJ-A - Phase 1');
    expect(report.generatedBy).toBe('Alex');
    expect(report.units.map(u => [u.doc_no, u.unit_type, u.state])).toEqual([['UZ1', 'Unit Z', 'In progress'], ['UZ2', 'Unit Z', 'Complete']]);
  });

  it('turns each check into a row, keeping the heading it sits under and leaving headings out', () => {
    const rows = report.units[0].categories[0].rows;
    expect(rows.map(r => [r.description, r.section, r.status])).toEqual([
      ['Label fitted', 'Mechanical', 'Complete'],
      ['Latch, rear', 'Mechanical', 'Incomplete'],
      ['Image', 'Software', 'Not answered'],
      ['Printer', 'Software', 'N/A'],
    ]);
  });

  it('formats dates and shows none for a check that has not been answered', () => {
    const rows = report.units[0].categories[0].rows;
    expect(rows[0].date_checked).toBe('03/11/2026');
    expect(rows[1].date_checked).toBe('02/11/2026');
    expect(rows[2].date_checked).toBe('');
    expect(formatReportDate('')).toBe('');
    expect(formatReportDate('not a date')).toBe('not a date');
  });

  it('adds up the totals the cover page shows', () => {
    expect(report.totals).toEqual({ units: 2, unitsComplete: 1, unitsWithFailures: 1, checks: 5, done: 3, failed: 1, unanswered: 1, percentDone: 60 });
  });

  it('copes with nothing selected', () => {
    const empty = buildReport([]);
    expect(empty.title).toBe('');
    expect(empty.totals.percentDone).toBe(0);
    expect(reportFileName(empty, 'csv')).toBe('FAT_report.csv');
  });

  it('makes a safe file name', () => {
    expect(reportFileName(report, 'pdf')).toBe('FAT_PRJ-A_-_Phase_1.pdf');
  });
});

describe('reportCsv', () => {
  const report = buildReport(docs, { phaseName: 'Phase 1' });
  const csv = reportCsv(report);
  const lines = csv.split('\r\n');

  it('starts with a byte-order mark and the column names, and ends with a line break', () => {
    expect(csv.charAt(0)).toBe('﻿');
    expect(lines[0]).toBe('﻿' + CSV_COLUMNS.join(','));
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('has one row per check', () => {
    // header + 4 checks in UZ1 + 1 in UZ2 + the empty line after the last break
    expect(lines.length).toBe(1 + 5 + 1);
    expect(lines[1]).toBe('PRJ-A,Phase 1,UZ1,SN-1,Unit Z,HQ,Kiosk Common,Mechanical,Label fitted,Fit the label,Complete,ok,Alex,,03/11/2026');
  });

  it('quotes commas, quotes and line breaks', () => {
    expect(lines[2]).toContain('"Latch, rear"');
    expect(lines[2]).toContain('"Sticks ""badly"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('stops a spreadsheet from running typed text as a formula', () => {
    expect(lines[4]).toContain(",'=SUM(A1),");
    expect(csvCell('-5 volts')).toBe("'-5 volts");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('2026-11-03')).toBe('2026-11-03');
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('0');
  });
});
