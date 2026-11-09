// The FAT report, as data. The preview on screen, the PDF and the CSV file are all made from this one model, so
// they always agree about what each unit's checks and totals are.

import { FATState, IFatCheckSummary, fatState, isFatHeading, summariseFatChecks } from '@webproject/data';
import { unitTypeName } from '../fat-options';

export interface ReportRow {
  // The section heading this check sits under in the checklist ('' when it has none).
  section: string;
  description: string;
  reference: string;
  // 'Complete', 'Incomplete', 'N/A' or 'Not answered'.
  status: string;
  comment: string;
  checked_by: string;
  second_checker: string;
  // dd/MM/yyyy, or '' when the check has not been answered.
  date_checked: string;
}

export interface ReportCategory {
  name: string;
  progress: number;
  rows: ReportRow[];
}

export interface ReportUnit {
  doc_no: string;
  unit_no: string;
  unit_type: string;
  location: string;
  progress: number;
  state: FATState;
  summary: IFatCheckSummary;
  categories: ReportCategory[];
}

export interface ReportTotals {
  units: number;
  unitsComplete: number;
  unitsWithFailures: number;
  checks: number;
  done: number;
  failed: number;
  unanswered: number;
  percentDone: number;
}

export interface FatReport {
  project: string;
  phase: string;
  title: string;
  generatedAt: Date;
  generatedBy: string;
  units: ReportUnit[];
  totals: ReportTotals;
}

const pad = (n: number) => (n < 10 ? '0' : '') + n;

// dd/MM/yyyy from a stored date: either 2026-11-03 or a full ISO time stamp. Anything else is shown as it is.
export function formatReportDate(value: any): string {
  if (!value) {
    return '';
  }
  const text = String(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : text;
}

export function formatReportTimestamp(date: Date): string {
  return pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear() + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function statusLabel(status: any): string {
  return status === 'Complete' || status === 'Incomplete' || status === 'N/A' ? status : 'Not answered';
}

function buildCategory(category: any): ReportCategory {
  let section = '';
  const rows: ReportRow[] = [];
  (category.checklists || []).forEach((check: any) => {
    if (isFatHeading(check)) {
      section = check.description || '';
      return;
    }
    rows.push({
      section,
      description: check.description || '',
      reference: check.reference || '',
      status: statusLabel(check.status),
      comment: check.comment || '',
      checked_by: check.checked_by || '',
      second_checker: check.second_checker || '',
      date_checked: check.status ? formatReportDate(check.date_checked) : '',
    });
  });
  return { name: category.name || '', progress: category.progress || 0, rows };
}

export function buildReport(docs: any[], options: { phaseName?: string, generatedBy?: string, now?: Date } = {}): FatReport {
  const first = (docs && docs[0]) || {};
  const units: ReportUnit[] = (docs || []).map(doc => ({
    doc_no: doc.doc_no || '',
    unit_no: doc.unit_no || '',
    unit_type: unitTypeName(doc.unit_type || ''),
    location: doc.location || '',
    progress: doc.progress || 0,
    state: fatState(doc.progress),
    summary: summariseFatChecks(doc.category),
    categories: (doc.category || []).map(buildCategory),
  }));

  const checks = units.reduce((sum, u) => sum + u.summary.total, 0);
  const done = units.reduce((sum, u) => sum + u.summary.complete + u.summary.notApplicable, 0);
  const phase = options.phaseName || first.phase || '';
  return {
    project: first.project || '',
    phase,
    title: [first.project, phase].filter(Boolean).join(' - '),
    generatedAt: options.now || new Date(),
    generatedBy: options.generatedBy || '',
    units,
    totals: {
      units: units.length,
      unitsComplete: units.filter(u => u.state === 'Complete').length,
      unitsWithFailures: units.filter(u => u.summary.failed > 0).length,
      checks,
      done,
      failed: units.reduce((sum, u) => sum + u.summary.failed, 0),
      unanswered: units.reduce((sum, u) => sum + u.summary.unanswered, 0),
      percentDone: checks ? Math.round((done / checks) * 100) : 0,
    },
  };
}

// A safe file name such as FAT_PRJ-ALPHA_Phase_1.pdf.
export function reportFileName(report: FatReport, extension: string): string {
  const base = report.title ? 'FAT_' + report.title : 'FAT_report';
  return base.replace(/[^\w.-]+/g, '_') + '.' + extension;
}

// ---------- CSV ----------

export const CSV_COLUMNS = [
  'Project', 'Phase', 'Unit', 'Serial No.', 'Type', 'Location', 'Category', 'Section', 'Description', 'Reference',
  'Status', 'Comment', 'Main Checker', 'Second Checker', 'Date Checked',
];

// One cell. Quoted when it holds a comma, quote or line break. A cell that starts with = + - or @ would be run as a
// formula by a spreadsheet, so it is given a leading apostrophe (typed text such as a comment could be anything).
export function csvCell(value: any): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

// One row per check (section headings are not checks; they appear in the Section column instead). Lines end in
// CRLF and the file starts with a byte-order mark so Excel opens it as UTF-8.
export function reportCsv(report: FatReport): string {
  const lines: string[] = [CSV_COLUMNS.map(csvCell).join(',')];
  report.units.forEach(unit => {
    unit.categories.forEach(category => {
      category.rows.forEach(row => {
        lines.push([
          report.project, report.phase, unit.doc_no, unit.unit_no, unit.unit_type, unit.location, category.name, row.section,
          row.description, row.reference, row.status, row.comment, row.checked_by, row.second_checker, row.date_checked,
        ].map(csvCell).join(','));
      });
    });
  });
  return '﻿' + lines.join('\r\n') + '\r\n';
}
