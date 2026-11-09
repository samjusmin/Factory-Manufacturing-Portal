// The two ways to get a report out of the app. Kept apart from the pages so they are easy to replace in tests.

import { FatReport, reportCsv, reportFileName } from './fat-report';
import { createReportPdf } from './fat-report-pdf';

// Hands a file to the browser as a download.
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Give the browser a moment to start the download before the address is released.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportReportCsv(report: FatReport) {
  downloadBlob(new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' }), reportFileName(report, 'csv'));
}

export function exportReportPdf(report: FatReport) {
  createReportPdf(report).save(reportFileName(report, 'pdf'));
}
