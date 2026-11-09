// Draws the FAT report as a real (vector) PDF: selectable text, rows that never split across pages, a repeated
// column heading on every page, and "Page x of y" on every page. The layout is a cover page (totals, a table of the
// units, and the failed checks), one section per unit, and a sign-off block on the last page.

import jsPDF from 'jspdf';
import { FatReport, ReportUnit, formatReportTimestamp } from './fat-report';

type Rgb = [number, number, number];

interface Column {
  title: string;
  width: number;
  align?: 'left' | 'right';
}

interface Cell {
  text: string;
  color?: Rgb;
  bold?: boolean;
}

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;
const MARGIN = 12;
const BOTTOM = PAGE_HEIGHT - 14;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const CELL_PAD_X = 1.6;
const CELL_PAD_Y = 1.4;

const BLUE: Rgb = [0, 94, 184];
const DARK_BLUE: Rgb = [0, 61, 122];
const INK: Rgb = [31, 42, 55];
const GREY: Rgb = [95, 99, 104];
const LIGHT_GREY: Rgb = [244, 244, 246];
const RULE: Rgb = [220, 220, 225];
const GREEN: Rgb = [10, 107, 46];
const RED: Rgb = [198, 40, 40];
const AMBER: Rgb = [138, 90, 0];

// The built-in PDF fonts only hold Latin-1 characters; anything else would come out as junk, so it is swapped for a
// plain equivalent (or a question mark) first.
export function pdfText(value: any): string {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\xFF]/g, '?');
}

function statusColor(status: string): Rgb {
  switch (status) {
    case 'Complete': return GREEN;
    case 'Incomplete': return RED;
    case 'N/A': return GREY;
    default: return AMBER;
  }
}

class ReportWriter {
  readonly doc: jsPDF;
  private y = MARGIN;

  constructor(private report: FatReport) {
    this.doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    this.doc.setLineHeightFactor(1.25);
    this.doc.setProperties({ title: 'FAT report - ' + pdfText(report.title), subject: 'Factory acceptance test report', creator: 'Shopfloor Console' });
  }

  // ---------- low-level helpers ----------

  private font(size: number, bold = false, color: Rgb = INK) {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  private fill(color: Rgb) {
    this.doc.setFillColor(color[0], color[1], color[2]);
  }

  private line(color: Rgb, x1: number, y1: number, x2: number, y2: number) {
    this.doc.setDrawColor(color[0], color[1], color[2]);
    this.doc.setLineWidth(0.2);
    this.doc.line(x1, y1, x2, y2);
  }

  // Height of one line of the current font, in mm.
  private lineHeight(): number {
    return this.doc.getLineHeight() / this.doc.internal.scaleFactor;
  }

  private wrap(text: string, width: number): string[] {
    const lines = this.doc.splitTextToSize(pdfText(text) || ' ', width) as string[];
    return lines.length ? lines : [''];
  }

  private newPage() {
    this.doc.addPage();
    this.y = MARGIN;
  }

  // Starts a new page when the next block of the given height would not fit on this one.
  private ensure(height: number) {
    if (this.y + height > BOTTOM) {
      this.newPage();
    }
  }

  // ---------- tables ----------

  private tableHeader(columns: Column[]) {
    const size = 7.5;
    this.font(size, true, GREY);
    const height = this.lineHeight() + 2 * CELL_PAD_Y;
    this.fill(LIGHT_GREY);
    this.doc.rect(MARGIN, this.y, CONTENT_WIDTH, height, 'F');
    let x = MARGIN;
    columns.forEach(col => {
      const textX = col.align === 'right' ? x + col.width - CELL_PAD_X : x + CELL_PAD_X;
      this.doc.text(pdfText(col.title).toUpperCase(), textX, this.y + CELL_PAD_Y, { baseline: 'top', align: col.align === 'right' ? 'right' : 'left' });
      x += col.width;
    });
    this.y += height;
  }

  // Draws a table. A row is never split: if it does not fit, the page is turned and the heading drawn again (after
  // `repeat`, which can draw a line saying what the table is about).
  private table(columns: Column[], rows: Cell[][], repeat?: () => void) {
    const size = 8.5;
    const firstHeight = 2 * CELL_PAD_Y + 7;
    this.ensure(firstHeight + 8);
    this.tableHeader(columns);

    rows.forEach((row, index) => {
      this.font(size);
      const wrapped = row.map((cell, i) => this.wrap(cell.text, columns[i].width - 2 * CELL_PAD_X));
      const lines = Math.max(...wrapped.map(w => w.length));
      const height = lines * this.lineHeight() + 2 * CELL_PAD_Y;

      if (this.y + height > BOTTOM) {
        this.newPage();
        if (repeat) {
          repeat();
        }
        this.tableHeader(columns);
      }

      if (index % 2 === 1) {
        this.fill([250, 250, 252]);
        this.doc.rect(MARGIN, this.y, CONTENT_WIDTH, height, 'F');
      }
      let x = MARGIN;
      row.forEach((cell, i) => {
        const col = columns[i];
        this.font(size, !!cell.bold, cell.color || INK);
        const textX = col.align === 'right' ? x + col.width - CELL_PAD_X : x + CELL_PAD_X;
        this.doc.text(wrapped[i], textX, this.y + CELL_PAD_Y, { baseline: 'top', align: col.align === 'right' ? 'right' : 'left' });
        x += col.width;
      });
      this.line(RULE, MARGIN, this.y + height, MARGIN + CONTENT_WIDTH, this.y + height);
      this.y += height;
    });
  }

  // ---------- cover page ----------

  private statBox(x: number, width: number, value: string, label: string, color: Rgb) {
    const height = 22;
    this.fill([255, 255, 255]);
    this.doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
    this.doc.setLineWidth(0.3);
    this.doc.roundedRect(x, this.y, width, height, 1.5, 1.5, 'S');
    this.font(20, true, color);
    this.doc.text(pdfText(value), x + 5, this.y + 4, { baseline: 'top' });
    this.font(8.5, false, GREY);
    this.doc.text(pdfText(label), x + 5, this.y + 14.5, { baseline: 'top' });
  }

  private cover() {
    const { totals } = this.report;

    this.font(9, true, BLUE);
    this.doc.text('FACTORY ACCEPTANCE TEST REPORT', MARGIN, this.y, { baseline: 'top' });
    this.y += 6;

    this.font(22, true, INK);
    const title = this.wrap(this.report.title || 'FAT report', CONTENT_WIDTH);
    this.doc.text(title, MARGIN, this.y, { baseline: 'top' });
    this.y += title.length * this.lineHeight() + 1;

    this.font(9.5, false, GREY);
    const by = this.report.generatedBy ? ' by ' + this.report.generatedBy : '';
    this.doc.text(pdfText('Generated ' + formatReportTimestamp(this.report.generatedAt) + by + '   |   ' + totals.units + (totals.units === 1 ? ' unit' : ' units')), MARGIN, this.y, { baseline: 'top' });
    this.y += 9;

    const gap = 6;
    const width = (CONTENT_WIDTH - 3 * gap) / 4;
    this.statBox(MARGIN, width, String(totals.units), totals.unitsComplete + ' complete', DARK_BLUE);
    this.statBox(MARGIN + (width + gap), width, totals.percentDone + '%', totals.done + ' of ' + totals.checks + ' checks done', totals.percentDone === 100 ? GREEN : DARK_BLUE);
    this.statBox(MARGIN + 2 * (width + gap), width, String(totals.failed), totals.failed === 1 ? 'check failed' : 'checks failed', totals.failed ? RED : GREEN);
    this.statBox(MARGIN + 3 * (width + gap), width, String(totals.unanswered), totals.unanswered === 1 ? 'check not answered' : 'checks not answered', totals.unanswered ? AMBER : GREEN);
    this.y += 22 + 8;

    this.sectionTitle('Units in this report');
    this.table(
      [
        { title: 'Unit', width: 30 }, { title: 'Serial No.', width: 44 }, { title: 'Type', width: 55 }, { title: 'Location', width: 52 },
        { title: 'Status', width: 28 }, { title: 'Progress', width: 22, align: 'right' }, { title: 'Failed', width: 20, align: 'right' }, { title: 'To do', width: 22, align: 'right' },
      ],
      this.report.units.map(u => [
        { text: u.doc_no, bold: true }, { text: u.unit_no || '-' }, { text: u.unit_type }, { text: u.location },
        { text: u.state, color: u.state === 'Complete' ? GREEN : u.state === 'In progress' ? AMBER : GREY },
        { text: u.progress + '%' },
        { text: u.summary.failed ? String(u.summary.failed) : '-', color: u.summary.failed ? RED : GREY, bold: u.summary.failed > 0 },
        { text: u.summary.unanswered ? String(u.summary.unanswered) : '-' },
      ]),
      () => this.continuedLine('Units in this report')
    );
    this.y += 8;

    this.failedChecks();
  }

  private sectionTitle(text: string) {
    this.ensure(18);
    this.font(12, true, DARK_BLUE);
    this.doc.text(pdfText(text), MARGIN, this.y, { baseline: 'top' });
    this.y += 7;
  }

  // "Units in this report (continued)" at the top of a table that has run onto a new page.
  private continuedLine(text: string) {
    this.font(9, true, GREY);
    this.doc.text(pdfText(text + ' (continued)'), MARGIN, this.y, { baseline: 'top' });
    this.y += 6;
  }

  private failedChecks() {
    this.sectionTitle('Failed checks');
    const rows: Cell[][] = [];
    this.report.units.forEach(unit => {
      unit.summary.items.filter(i => i.status).forEach(item => {
        rows.push([{ text: unit.doc_no, bold: true }, { text: item.category }, { text: item.description }, { text: item.comment || '-' }]);
      });
    });

    if (!rows.length) {
      this.font(9.5, false, GREEN);
      this.doc.text('No checks have been marked as failed.', MARGIN, this.y, { baseline: 'top' });
      this.y += 9;
    } else {
      this.table(
        [{ title: 'Unit', width: 30 }, { title: 'Category', width: 55 }, { title: 'Check', width: 118 }, { title: 'Note', width: 70 }],
        rows,
        () => this.continuedLine('Failed checks')
      );
      this.y += 6;
    }

    const unanswered = this.report.totals.unanswered;
    if (unanswered) {
      this.ensure(8);
      this.font(9, false, GREY);
      this.doc.text(pdfText(unanswered + (unanswered === 1 ? ' check has' : ' checks have') + ' not been answered yet. They are listed on each unit\'s pages.'), MARGIN, this.y, { baseline: 'top' });
      this.y += 8;
    }
  }

  private signOff() {
    this.ensure(48);
    this.y += 4;
    this.sectionTitle('Sign-off');
    const gap = 10;
    const width = (CONTENT_WIDTH - 2 * gap) / 3;
    ['Prepared by', 'Reviewed by', 'Approved by'].forEach((role, i) => {
      const x = MARGIN + i * (width + gap);
      this.font(9, true, INK);
      this.doc.text(role, x, this.y, { baseline: 'top' });
      ['Name', 'Signature', 'Date'].forEach((label, j) => {
        const lineY = this.y + 17 + j * 9;
        this.line(GREY, x, lineY, x + width, lineY);
        this.font(7.5, false, GREY);
        this.doc.text(label, x, lineY + 1, { baseline: 'top' });
      });
    });
    this.y += 17 + 3 * 9;
  }

  // ---------- unit pages ----------

  private unitHeading(unit: ReportUnit, continued = false) {
    this.font(15, true, INK);
    const serial = unit.unit_no ? '  |  ' + unit.unit_no : '';
    this.doc.text(pdfText(unit.doc_no + serial + (continued ? ' (continued)' : '')), MARGIN, this.y, { baseline: 'top' });
    this.y += 7;
    if (!continued) {
      this.font(9, false, GREY);
      const failed = unit.summary.failed ? unit.summary.failed + ' failed' : 'no failed checks';
      this.doc.text(pdfText(unit.unit_type + '  |  ' + unit.location + '  |  ' + unit.progress + '% complete  |  ' + failed + '  |  ' + unit.summary.unanswered + ' not answered'), MARGIN, this.y, { baseline: 'top' });
      this.y += 7;
    }
  }

  private unit(unit: ReportUnit) {
    this.newPage();
    this.unitHeading(unit);

    const columns: Column[] = [
      { title: 'Check', width: 82 }, { title: 'Reference', width: 42 }, { title: 'Status', width: 24 }, { title: 'Comment', width: 50 },
      { title: 'Checker', width: 25 }, { title: '2nd checker', width: 26 }, { title: 'Date', width: 24 },
    ];

    unit.categories.forEach(category => {
      this.ensure(30);
      this.fill([230, 240, 250]);
      this.doc.rect(MARGIN, this.y, CONTENT_WIDTH, 7, 'F');
      this.font(10, true, DARK_BLUE);
      this.doc.text(pdfText(category.name), MARGIN + 2, this.y + 1.7, { baseline: 'top' });
      this.doc.text(category.progress + '% complete', MARGIN + CONTENT_WIDTH - 2, this.y + 1.7, { baseline: 'top', align: 'right' });
      this.y += 7;

      if (!category.rows.length) {
        this.font(9, false, GREY);
        this.doc.text('This category has no checks.', MARGIN + 2, this.y + 2, { baseline: 'top' });
        this.y += 9;
        return;
      }

      const rows: Cell[][] = [];
      category.rows.forEach(row => {
        rows.push([
          { text: (row.section ? row.section + ': ' : '') + row.description },
          { text: row.reference },
          { text: row.status, color: statusColor(row.status), bold: row.status === 'Incomplete' },
          { text: row.comment },
          { text: row.checked_by },
          { text: row.second_checker },
          { text: row.date_checked },
        ]);
      });
      this.table(columns, rows, () => this.unitHeading(unit, true));
      this.y += 6;
    });
  }

  // ---------- page footers ----------

  private footers() {
    const pages = this.doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      this.doc.setPage(page);
      this.line(RULE, MARGIN, PAGE_HEIGHT - 10, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 10);
      this.font(8, false, GREY);
      this.doc.text(pdfText('FAT report - ' + this.report.title), MARGIN, PAGE_HEIGHT - 8, { baseline: 'top' });
      this.doc.text('Page ' + page + ' of ' + pages, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { baseline: 'top', align: 'right' });
    }
  }

  build(): jsPDF {
    this.cover();
    this.report.units.forEach(unit => this.unit(unit));
    this.signOff();
    this.footers();
    return this.doc;
  }
}

export function createReportPdf(report: FatReport): jsPDF {
  return new ReportWriter(report).build();
}
