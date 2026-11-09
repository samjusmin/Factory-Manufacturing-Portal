import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { FATProjectService } from '../../fat-project.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { buildReport } from '../../fat-report/fat-report';
import { exportReportCsv } from '../../fat-report/fat-report-export';

const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

@Component({
  selector: 'webproject-fat-pdf-select-units',
  templateUrl: './fat-pdf-select-units.component.html',
  styleUrls: ['./fat-pdf-select-units.component.css']
})
export class FatPdfSelectUnitsComponent implements OnInit {

  @Output() dataLoaded: EventEmitter<any> = new EventEmitter<any>();

  postData: Array<string> = [];
  //form: FormGroup;
  emailFormArray: Array<any> = [];
  project = '';
  phase = '';

  constructor(
    private http: HttpClient, 
    private router: Router,
    public FATProjectService: FATProjectService,
    private formBuilder: FormBuilder
  ) { }

  ngOnInit(): void {
    this.FATProjectService.checkIfAdmin();

    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 4);
    console.log("This is the route")
    console.log(routePaths)

    this.project = routePaths[2].replace(/\%20/g, " ");
    this.phase = routePaths[3].replace(/\%20/g, " ");

    this.FATProjectService.getAllProjectPhaseUnits(this.project, this.phase);
    this.FATProjectService.getPhaseName(this.project, this.phase);
  }

  exporting = false;

  get units(): any[] {
    return this.FATProjectService.unitsource.filteredData || [];
  }

  get allSelected(): boolean {
    return this.units.length > 0 && this.emailFormArray.length === this.units.length;
  }

  get someSelected(): boolean {
    return this.emailFormArray.length > 0 && !this.allSelected;
  }

  isSelected(val: string): boolean {
    return this.emailFormArray.includes(val);
  }

  progressColour(progress: number): boolean {
    return progress == 100;
  }

  toggleAll(isChecked: boolean) {
    this.emailFormArray = isChecked ? this.units.map(unit => unit.doc_no) : [];
  }

  onChange(val:string, isChecked: boolean) {
    if(isChecked) {
      if (!this.isSelected(val)) {
        this.emailFormArray.push(val);
      }
    }
    else {
      let index = this.emailFormArray.indexOf(val);
      if (index > -1) {
        this.emailFormArray.splice(index,1);
      }
    }
}

  // Which action is running ('' when none) and why the last one failed. The selection is kept on a failure.
  working: '' | 'preview' | 'csv' = '';
  error = '';

  // The full checklists of the selected units.
  private fetchSelected() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    return this.http.post<any[]>('/api/factory-acceptance-test/'+ this.project + "/" + this.phase, {data: this.emailFormArray}, httpOptions);
  }

  onSubmit() {
    if (!this.emailFormArray.length || this.exporting) {
      return;
    }
    this.exporting = true;
    this.working = 'preview';
    this.error = '';
    this.fetchSelected().subscribe(
      (data) => {
         this.emailFormArray = [];
         this.FATProjectService.setPdfData(data);
         this.router.navigateByUrl('/FAT-pdf');
      },
      (error) => {
        this.exporting = false;
        this.working = '';
        this.error = 'The report could not be prepared. Your selection is still here, so you can try again.';
        throw error;
      }
    )
  }

  // Downloads the selected units as a CSV file straight away, without the preview.
  exportCsv() {
    if (!this.emailFormArray.length || this.exporting) {
      return;
    }
    this.exporting = true;
    this.working = 'csv';
    this.error = '';
    this.fetchSelected().subscribe(
      (data) => {
        try {
          exportReportCsv(buildReport(data, { phaseName: this.FATProjectService.phaseName, generatedBy: localStorage.getItem('name') || '' }));
        } catch (error) {
          console.error(error);
          this.error = 'The CSV file could not be created. Your selection is still here, so you can try again.';
        }
        this.exporting = false;
        this.working = '';
      },
      (error) => {
        this.exporting = false;
        this.working = '';
        this.error = 'The CSV file could not be prepared. Your selection is still here, so you can try again.';
        throw error;
      }
    );
  }


  getProject() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 4);
    return routePaths[2].replace(/\%20/g, " ");
  }

  getPhase() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 4);
    let phase = routePaths[3];
    return phase.replace(/\%20/g, " ");
  }  

}
