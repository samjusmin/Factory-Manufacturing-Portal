import { buildReport } from './fat-report';
import { createReportPdf, pdfText } from './fat-report-pdf';

const check = (n: number, status: string | null = 'Complete') => ({
  description: 'Check number ' + n + ' with a fairly long description so that it needs to wrap onto a second line in its column',
  reference: 'Ref ' + n, status, comment: status === 'Incomplete' ? 'Needs rework' : '', checked_by: 'Alex', date_checked: '2026-11-03',
});

const unit = (doc_no: string, checks: number, failedEvery = 0) => ({
  doc_no, unit_no: 'SN-' + doc_no, project: 'PRJ-A', phase: 'ph1', unit_type: 'unit-z', location: 'Meridian HQ', progress: 40,
  category: [{ name: 'Kiosk Common', progress: 40, checklists: Array.from({ length: checks }, (_, i) => check(i, failedEvery && i % failedEvery === 0 ? 'Incomplete' : i % 3 ? 'Complete' : null)) }],
});

// The PDF is written without compression, so the text drawn on a page can be found in its output.
const text = (docs: any[]) => {
  const pdf = createReportPdf(buildReport(docs, { phaseName: 'Phase 1', generatedBy: 'Alex' }));
  return { pdf, out: pdf.output() as string };
};

describe('createReportPdf', () => {
  it('makes a cover page followed by a page for each unit', () => {
    const { pdf, out } = text([unit('UZ1', 3), unit('UZ2', 3)]);
    expect(pdf.getNumberOfPages()).toBe(3);
    expect(out).toContain('PRJ-A - Phase 1');
    expect(out).toContain('FACTORY ACCEPTANCE TEST REPORT');
    expect(out).toContain('UZ2');
  });

  it('puts the totals, the sign-off block and a footer with page numbers on the report', () => {
    const { pdf, out } = text([unit('UZ1', 6, 2)]);
    expect(out).toContain('Failed checks');
    expect(out).toContain('Sign-off');
    expect(out).toContain('Prepared by');
    const pages = (pdf.getNumberOfPages());
    expect(out).toContain('(Page 1 of ' + pages + ')');
    expect(out).toContain('(Page ' + pages + ' of ' + pages + ')');
  });

  it('carries a unit with many checks across pages without losing any', () => {
    const { pdf, out } = text([unit('UZ1', 120)]);
    // cover + several pages for the 120 checks
    expect(pdf.getNumberOfPages()).toBeGreaterThan(3);
    expect(out).toContain('Check number 119');
    // Parentheses are escaped inside a PDF string.
    expect(out).toContain('UZ1  |  SN-UZ1 \\(continued\\)');
  });

  it('says so when no check has failed, and still makes a report with no units', () => {
    expect(text([unit('UZ1', 3)]).out).toContain('No checks have been marked as failed.');
    const empty = text([]);
    expect(empty.pdf.getNumberOfPages()).toBe(1);
  });

  it('replaces characters the PDF font cannot show', () => {
    expect(pdfText('Café — “ok” … 中')).toBe('Café - "ok" ... ?');
    expect(pdfText(null)).toBe('');
    expect(pdfText('line\nbreak')).toBe('line break');
  });
});
