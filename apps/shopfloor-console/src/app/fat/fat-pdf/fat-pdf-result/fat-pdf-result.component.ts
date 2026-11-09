import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FATProjectService } from '../../fat-project.service';
import { FatReport, buildReport } from '../../fat-report/fat-report';
import { exportReportCsv, exportReportPdf } from '../../fat-report/fat-report-export';

@Component({
  selector: 'webproject-fat-pdf-result',
  templateUrl: './fat-pdf-result.component.html',
  styleUrls: ['./fat-pdf-result.component.css']
})
export class FatPdfResultComponent implements OnInit {
  // What the page shows and both exports are made from.
  report: FatReport | null = null;
  // Which export is being made ('' when none), and why the last one failed.
  exporting: '' | 'pdf' | 'csv' = '';
  exportError = '';

  constructor(
    private router: Router,
    public FATProjectService: FATProjectService,
    ) {
      FATProjectService.showError = false;
      FATProjectService.isLoaded = false;
      FATProjectService.notCompany = false;
  }

  ngOnInit() {
    this.FATProjectService.checkIfAdmin();

    this.FATProjectService.getPdfData().subscribe(data => {
      // No units selected yet (e.g. the page was opened directly): go back to the project list.
      if (!data || !data.length) {
        this.router.navigateByUrl('/FAT-project-list');
        return;
      }
      // The report is named after the phase, so wait for its name (the phase id is used if it cannot be found).
      this.FATProjectService.loadPhaseName(data[0].project, data[0].phase).subscribe(
        (name) => this.report = this.makeReport(data, name),
        () => this.report = this.makeReport(data, '')
      );
    });
  }

  private makeReport(data: any[], phaseName: string): FatReport {
    return buildReport(data, { phaseName, generatedBy: localStorage.getItem('name') || '' });
  }

  // The cover page, the PDF and the CSV all show the time the report was made, so refresh it for each export.
  private freshReport(): FatReport {
    return { ...this.report, generatedAt: new Date() };
  }

  exportPdf() {
    this.run('pdf', () => exportReportPdf(this.freshReport()), 'The PDF could not be created.');
  }

  exportCsv() {
    this.run('csv', () => exportReportCsv(this.freshReport()), 'The CSV file could not be created.');
  }

  // Runs an export after the button has had a chance to show "Preparing...", and says so if it fails.
  private run(kind: 'pdf' | 'csv', work: () => void, failure: string) {
    if (!this.report || this.exporting) {
      return;
    }
    this.exporting = kind;
    this.exportError = '';
    setTimeout(() => {
      try {
        work();
      } catch (error) {
        console.error(error);
        this.exportError = failure + ' Try again, or export fewer units.';
      }
      this.exporting = '';
    });
  }
}
