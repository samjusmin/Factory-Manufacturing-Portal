import { ElementRef, Injectable, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { DialogBoxConfirmationComponent } from '../dialog-box/confirmation/confirmation-dialog-box';
import { DialogBoxMessageComponent } from '../dialog-box/message/message-dialog-box';
import { DialogBoxFaultyReportComponent } from '../dialog-box/faulty-report/faulty-report-dialog-box';

import {
  FATAddChecklist,
  FATUnit,
  FATcategory,
  FATchecklist,
  FAToptions,
  ISerialSearchFilters,
  ISerialSearchQuery,
  ISerialSearchResult,
  SERIAL_SEARCH_FILTER_KEYS,
  FATtype,
  FATunitType,
  IFATPhase,
  IFATProject,
  FATUnitComments,
  IFactoryTest,
  FATEntry,
  IFatCheckCounts,
  IFatCheckSummary,
  FATState,
  FAT_STATE_ORDER,
  fatState
} from '@webproject/data';
import { FAT_UNIT_OPTIONS } from './fat-options';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort, Sort } from '@angular/material/sort';
import { GeneralDialogBoxComponent } from '../dialog-box/general-dialog/general-dialog-box';
import { concatMap, filter, map } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';

const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

@Injectable({
    providedIn: 'root'
})

export class FATProjectService {

  private _pdfData: BehaviorSubject<any> = new BehaviorSubject<any>(null)
  datasource = new MatTableDataSource<IFATProject>();
  phasesource = new MatTableDataSource<IFATPhase>();
  unitsource =  new MatTableDataSource<FATUnit>();
  categorysource =  new Array<FATcategory>();
  checklistsource = new MatTableDataSource<FATchecklist>();
  oldchecklistsource = new MatTableDataSource<FATchecklist>();
  typesource = new Array<string>();
  typeunitsource = new Array<FATunitType>();
  excludedOptions = new Array<FAToptions>();
  commentSource = new String;
  allUnitsCommentSource = new Array<FATUnitComments>();;
  allUnitsChecklist = new Array<FATchecklist>();
  isLoaded = false;
  oneUnit = "";
  untouched = true;
  oldchecklist;
  isAdmin = false;
  showError = false;
  notCompany = false;
  phaseName = '';
  // The admin answer for the signed-in token, so moving between pages does not make the admin buttons blink out
  // while the check is asked again. A new sign-in has a new token, so it is asked afresh.
  private adminAnswer: { token: string, isAdmin: boolean } | null = null;

  constructor(
    private _location: Location,
    private http: HttpClient,
    public router: Router,
    public dialog: MatDialog,
  ) { }

  // The project, phase and unit lists share these. The text search and the status button combine (AND).
  searchText = '';
  statusFilter: 'All' | FATState = 'All';
  // The unit list's "failed checks" button, and each unit's check counts (by unit number) it is worked out from.
  attentionOnly = false;
  unitChecks: { [docNo: string]: IFatCheckCounts } = {};
  // Set when a list could not be loaded, so the page can offer a retry instead of staying blank.
  loadError = false;
  // The sort of the list page on screen, so a list that is re-fetched in place keeps working sort headers.
  listSort: MatSort | null = null;

  // Starts a list load: clears the previous list (this service lives for the whole session, so the last project's
  // rows would otherwise flash) and the previous filters.
  private beginListLoad() {
    this.isLoaded = false;
    this.loadError = false;
    this.searchText = '';
    this.statusFilter = 'All';
    this.attentionOnly = false;
    this.unitChecks = {};
    this.listSort = null;
  }

  // Called by a list page when its table (and so its sort) appears.
  attachSort(sort: MatSort, source: MatTableDataSource<any>) {
    this.listSort = sort;
    source.sort = sort;
  }

  private listFailed(error: any) {
    this.isLoaded = true;
    this.loadError = true;
    throw error;
  }

  // Wires the shared predicate and sort accessor into one list's data source.
  private prepareList<T>(source: MatTableDataSource<T>, searchKeys: string[]) {
    source.filterPredicate = (row: any) => {
      // A row being typed in (new project) must not disappear while a filter is active.
      if (row.isEdit) {
        return true;
      }
      if (this.statusFilter !== 'All' && fatState(row.progress) !== this.statusFilter) {
        return false;
      }
      if (this.attentionOnly && row.doc_no !== undefined && !this.failedCount(row.doc_no)) {
        return false;
      }
      if (!this.searchText) {
        return true;
      }
      return searchKeys.map(k => row[k]).join(' ').toLowerCase().indexOf(this.searchText) !== -1;
    };
    source.sortingDataAccessor = (row: any, header: string) => {
      if (header === 'state') {
        return FAT_STATE_ORDER[fatState(row.progress)];
      }
      if (header === 'open') {
        const checks = this.unitChecks[row.doc_no];
        return checks ? checks.outstanding : 0;
      }
      return row[header];
    };
    if (this.listSort) {
      source.sort = this.listSort;
    }
    return source;
  }

  setStatusFilter(status: 'All' | FATState) {
    this.statusFilter = status;
    this.refilter();
  }

  setAttentionOnly(flag: boolean) {
    this.attentionOnly = flag;
    this.refilter();
  }

  failedCount(docNo: string): number {
    const checks = this.unitChecks[docNo];
    return checks ? checks.failed : 0;
  }

  // How many units of a phase have at least one failed check, for the count on the button.
  unitsWithFailures(): number {
    return Object.keys(this.unitChecks).filter(docNo => this.unitChecks[docNo].failed > 0).length;
  }

  // The check counts of every unit in a phase. Not essential to the page, so a failure leaves the counts blank
  // instead of raising an error.
  getPhaseOutstanding(project: string, phase: string) {
    this.http.get<Array<IFatCheckCounts & { doc_no: string }>>('/api/factory-acceptance-test/' + project + '/' + phase + '/getOutstanding', this.authOptions()).subscribe(
      (res) => {
        const byUnit: { [docNo: string]: IFatCheckCounts } = {};
        res.forEach(r => byUnit[r.doc_no] = r);
        this.unitChecks = byUnit;
        this.refilter();
      },
      () => { this.unitChecks = {}; }
    );
  }

  getUnitOutstanding(project: string, phase: string, unit: string) {
    return this.http.get<IFatCheckSummary>('/api/factory-acceptance-test/' + project + '/' + phase + '/' + unit + '/getOutstanding', this.authOptions());
  }

  // How many rows each status button would show, for the counts on the buttons.
  countByState(rows: Array<{ progress?: number }>, status: 'All' | FATState): number {
    return rows.filter(r => status === 'All' || fatState(r.progress) === status).length;
  }

  // Material only re-runs a predicate when the filter string changes, so encode every active filter in it.
  private refilter() {
    const key = [this.searchText, this.statusFilter, this.attentionOnly].join('|');
    this.datasource.filter = key;
    this.phasesource.filter = key;
    this.unitsource.filter = key;
  }

  getAllProjects() {
    this.beginListLoad();
    this.datasource = new MatTableDataSource<IFATProject>();
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
      .get<IFATProject[]>('/api/fat-project/', httpOptions)
      .subscribe((res) => {
        this.datasource = this.prepareList(new MatTableDataSource<IFATProject>(res), ['project', 'description']);
        this.isLoaded = true;
      }, (error) => this.listFailed(error));
  }

  getProjectPhases(project: any, refresh = false) {
    // Re-fetching after a rename keeps the list on screen; a fresh visit clears it.
    if (!refresh) {
      this.beginListLoad();
      this.phasesource = new MatTableDataSource<IFATPhase>();
    }
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
      .get<IFATPhase[]>('/api/fat-project/' + project, httpOptions)
      .subscribe((res) => {
        this.phasesource = this.prepareList(new MatTableDataSource<IFATPhase>(res), ['name', 'phase']);
        this.refilter();
        this.isLoaded = true;
        this.loadError = false;
      }, (error) => this.listFailed(error));
  }

  getAllProjectPhaseUnits(project: any, phase: any) {
    this.beginListLoad();
    this.unitsource = new MatTableDataSource<FATUnit>();
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
      .get<FATUnit[]>('/api/factory-acceptance-test/'+ project + '/' + phase, httpOptions)
      .subscribe((res) => {
        this.unitsource = this.prepareList(new MatTableDataSource<FATUnit>(res), ['doc_no', 'unit_no', 'location', 'unit_type']);
        this.isLoaded = true;
      }, (error) => this.listFailed(error));
      return this.unitsource;
  }

  addNewProject(entry: any) {
    console.log("ADDNEWPROJECT IN SERVICE IS WORKING");
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    return this.http.post<any>('/api/fat-project/', entry, httpOptions);
  }

  async getCategories(project: any, phase: any, unit: any) {
    console.log("getCategories is working");
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
      .get<FATcategory[]>('/api/factory-acceptance-test/'+ project + '/' + phase + '/' + unit, httpOptions)
      .subscribe((res) => {
        console.log("WHAT IS RES");
        console.log(res);
        if (res.length === 0) {
          this.notCompany = true;
        } else {
          this.categorysource = (res[0]['category']);
          this.isLoaded = true;
          console.log("THIS IS THE CATEGORYSOURCE")
          console.log(this.categorysource);
        }
      }, (error) => {
        throw error;
      });

    return this.categorysource;
    
  }
  
  // The version of the checklist category on screen. Every save raises it on the server, and a save has to name the
  // version it was made from, so two people editing the same checklist cannot silently overwrite each other.
  checklistVersion = 0;

  // The rows of one checklist and the version they are at, as a request (nothing on the page changes until the
  // caller decides what to do with them).
  fetchChecklist(category: any, project: any, phase: any, unit: any): Observable<{ rows: FATchecklist[], version: number }> {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    return this.http
      .get<FATchecklist[]>('/api/factory-acceptance-test/'+ project + '/' + phase + '/' + unit + '/' + category, { ...httpOptions, observe: 'response' })
      .pipe(map(res => ({ rows: res.body || [], version: Number(res.headers.get('X-Checklist-Version')) || 0 })));
  }

  getCategoryChecklists(category: any, project: any, phase: any, unit: any) {
    this.checkIfAdmin();
    this.fetchChecklist(category, project, phase, unit).subscribe(({ rows, version }) => {
        if (rows.length === 0) {
          this.notCompany = true;
        } else {
          this.checklistsource = new MatTableDataSource<FATchecklist>(rows);
          this.checklistVersion = version;
          this.isLoaded = true;
        }
      }, (error) => {
        throw error;
      });
    return this.checklistsource;
  }

  // Sends the whole checklist; the server works out which rows changed and stamps who checked them, and when. Returns
  // the request: the caller refreshes the list once the server has answered (refreshing straight away could show the
  // old data over the user's edits).
  updateChecklist(project: string, phase: string, unit: string, category: string) {
    this.checklistsource.data.forEach(entry => {
      if (entry.comment != null) {
        if (category === "Unit Name" || category === "Serial Numbers") {
          entry.comment = entry.comment.toUpperCase();
        }
      }
    })

    let update = {
      project: project,
      phase: phase,
      unit: unit,
      category: category,
      checklist: this.checklistsource.data,
      // The version these rows were loaded at; the server refuses the save if someone else has saved since.
      version: this.checklistVersion
    };

    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    return this.http.patch<any>('/api/factory-acceptance-test/', {element: update, type: "update"}, httpOptions);
  }

  // Returns the request so the caller can wait for it to finish before refreshing the list.
  removeCategory(category: any) {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    return this.http.patch<any>('/api/factory-acceptance-test/', {element: category, type: "remove"}, httpOptions);
  }

  applyFilter(filterValue: string) {
    this.searchText = (filterValue || '').trim().toLowerCase(); // MatTableDataSource defaults to lowercase matches
    this.refilter();
    // The checklist table has no status buttons, so it uses the plain text.
    this.checklistsource.filter = this.searchText;
  }

  // Deep Search. The server filters, sorts and pages, so one page of rows is asked for at a time.
  searchSerials(query: ISerialSearchQuery): Observable<ISerialSearchResult> {
    let params = new HttpParams()
      .set('q', query.q)
      .set('page', String(query.page))
      .set('pageSize', String(query.pageSize))
      .set('sort', query.sort)
      .set('dir', query.dir);
    SERIAL_SEARCH_FILTER_KEYS.forEach(key => query[key].forEach(value => params = params.append(key, value)));
    return this.http.get<ISerialSearchResult>('/api/factory-acceptance-test/serial-search', { headers: this.authOptions().headers, params });
  }

  // The choices the Deep Search filters offer.
  getSerialSearchFilters(): Observable<ISerialSearchFilters> {
    return this.http.get<ISerialSearchFilters>('/api/factory-acceptance-test/serial-search/filters', this.authOptions());
  }

  async getTypesinPhase(project: string, phase: string) {
    console.log("getTypesinPhase is working", project, phase)
    console.log("ISLOADED:", this.isLoaded);
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http.get<FATtype[]>('/api/factory-acceptance-test/' + project + '/' + phase + "/getTypes", httpOptions).subscribe(
      (data) => {
         console.log("POST call successful value returned in body", data);
         let newList = [];
         data.forEach(machine => {
          newList.push(machine._id)
         })
         this.typesource = newList;
         this.isLoaded = true;
         console.log("ISLOADED:", this.isLoaded);
      },
      (error) => {
        
        throw error;
      }
    );
    console.log("THIS IS THE CATEGORIESSOURCE AFTER", this.typesource)
    console.log("ISLOADED:", this.isLoaded);
    return;
    
    }

    // async getAllUnitType(project: string, phase: string, type: string) {
    //   console.log("RUNNING GETALLUNITTYPE");
    //   console.log("Project:", project, "Phase:", phase, "Type:", type)
    //   this.http.get<FATunitType[]>('/api/factory-acceptance-test/' + project + '/' + phase + '/' + type + "/getTypeUnits", httpOptions).subscribe(
    //     async (data) => {
    //       console.log("POST call successful value returned in body", data);
    //       this.typeunitsource = data;
    //       await this.getCategories(project, phase, data[0].doc_no);
    //       this.isLoaded = true;
    //     },
    //     (error) => {
          
    //       throw error;
    //     }
    //   );
    //   return this.typeunitsource
    // }

    async getAllUnitType(project: string, phase: string, type: string) {
      console.log("RUNNING GETALLUNITTYPE");
      console.log("Project:", project, "Phase:", phase, "Type:", type)
      this.http.get<FATAddChecklist>('/api/factory-acceptance-test/' + project + '/' + phase + '/' + type + "/getTypeUnits", httpOptions).subscribe(
        async (data) => {
          console.log("POST call successful value returned in body", data);
          this.typeunitsource = data.units;
          this.categorysource = data.categories;
          this.getExcludedOptions(data.categories);
          this.isLoaded = true;
        },
        (error) => {
          
          throw error;
        }
      );
      return this.typeunitsource
    }

    getExcludedOptions(included: Array<FATcategory>) {
      let options = FAT_UNIT_OPTIONS.map(o => ({name: o.name, value: o.value}));

      included.forEach(category => {
        // let index = options.indexOf(category.name, 0);
        var index =  options.findIndex(x => x.name==category.name);
        if (index > -1) {
          options.splice(index, 1);
        }
      })
      this.excludedOptions = options;
      console.log("THESE ARE THE INCLUDED OPTIONS", included)
      console.log("THESE ARE THE EXCLUDED OPTIONS", options)
    }

    goBack() {
      this._location.back();
    }

    async checkIfAdmin() {
      const token = localStorage.getItem('token');
      if (this.adminAnswer && this.adminAnswer.token === token) {
        this.applyAdmin(this.adminAnswer.isAdmin);
        return this.isAdmin;
      }
      // Not known for this sign-in yet: hide admin controls until the server says so.
      this.isAdmin = false;
      httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + token);
      this.http
        .get<boolean>('/api/fat-project/'+"adminCheck", httpOptions)
        .subscribe((res) => {
          this.adminAnswer = { token, isAdmin: res };
          this.applyAdmin(res);
        }, (error) => {
          throw error;
        });
      return this.isAdmin;
    }

    private applyAdmin(isAdmin: boolean) {
      this.isAdmin = isAdmin;
      if (!isAdmin) {
        this.showError = true;
      }
    }

    private authOptions() {
      httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
      return httpOptions;
    }

    // The admin forms below return the request, so a page can say "saved" only once the server has answered.

    // Creates a phase and its first units.
    createPhase(project: string, phase: string, entries: FATEntry[]) {
      return this.http.post<any>('/api/factory-acceptance-test/', {data: [{project, phase, entries}], type: "createnew"}, this.authOptions());
    }

    // Lets the chosen checkers see the phase, then creates the units; the second step only runs if the first worked.
    createUnits(project: string, phase: string, entries: FATEntry[]) {
      return this.http.post<any>('/api/fat-project/' + project, [project, phase, entries, "updateCheckers"], this.authOptions()).pipe(
        concatMap(() => this.http.post<any>('/api/factory-acceptance-test/', {data: [{project, phase, entries}], type: "create"}, this.authOptions()))
      );
    }

    moveUnits(project: string, fromPhase: string, toPhase: string, units: string[]) {
      return this.http.post<any>('/api/factory-acceptance-test/', {data: [{project, fromPhase, toPhase, units}], type: "move"}, this.authOptions());
    }

    addChecklists(project: string, phase: string, type: string, printers: number, honeywell: number, options: string[]) {
      return this.http.post<any>('/api/factory-acceptance-test/', {data: [{project, phase, type, printers: printers || 0, honeywell: honeywell || 0, options: options || []}], type: "addChecklists"}, this.authOptions());
    }

    getChecklistTemplate(category: string) {
      return this.http.get<Array<{description: string, reference: string}>>('/api/factory-acceptance-test/' + category, this.authOptions());
    }

    // Saves the checklist template that new units are created from.
    saveChecklistTemplate(category: string, rows: Array<{description: string, reference: string}>) {
      const checklists = rows.map(r => ({
        description: r.description,
        reference: r.reference,
        status: null,
        checked_by: null,
        date_checked: null,
        comment: null
      }));
      return this.http.patch<any>('/api/factory-acceptance-test/', {element: {category, checklists}, type: "edit"}, this.authOptions());
    }

    // Returns the request so the caller can show when the note has really been saved (or failed).
    saveUnitComment(project: string, phase: string, unit: string, comment: string) {
      let data = {
        project: project,
        phase: phase,
        unit: unit,
        comment: comment
      }
      httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
      return this.http.patch<any>('/api/factory-acceptance-test/', {element: data, type: "comment"}, httpOptions);
    }

    async getUnitComments(project: string, phase: string, unit: string) {
      console.log("RUNNING getUnitComments");
      httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
      this.http.get<any>('/api/factory-acceptance-test/' + project + '/' + phase + '/' + unit + "/getUnitComments", httpOptions).subscribe(
        async (data) => {
          console.log("POST call successful value returned in body", data);
          this.commentSource = data[0].comment;
          this.isLoaded = true;
        },
        (error) => {
          
          throw error;
        }
      );
      return this.commentSource
    }

    // The notes of every unit in a phase. A failure leaves the page able to offer a retry (loadError).
    getAllUnitComments(project: string, phase: string) {
      this.beginListLoad();
      this.allUnitsCommentSource = [];
      httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
      this.http.get<FATUnitComments[]>('/api/factory-acceptance-test/' + project + '/' + phase + "/getAllUnitComments", httpOptions).subscribe(
        (data) => {
          this.allUnitsCommentSource = data || [];
          this.isLoaded = true;
        },
        (error) => this.listFailed(error)
      );
    }


    async getAllUnitChecklists(project: string, phase: string) {
      console.log("RUNNING getAllChecklists");
      httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
      this.http.get<any>('/api/factory-acceptance-test/' + project + '/' + phase + "/getAllUnits", httpOptions).subscribe(
        async (data) => {
          console.log("getAllUnitChecklists POST call successful value returned in body", data);
          this.allUnitsChecklist = data;
          this.isLoaded = true;
        },
        (error) => {
          
          throw error;
        }
      );
      return this.allUnitsChecklist
    }

    getPhaseName(project: string, phaseID: string) {
      //let phaseName = '';
      httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
      this.http.get<any>('/api/fat-project/' + project + '/' + phaseID, httpOptions).subscribe(
         (data) => {
          console.log("getPhaseName value ", data);
          this.phaseName = data[0].name;
        },
        (error) => {
          throw error;
        }
      );
      console.log("SERVICE PHASE: ", this.phaseName);
      return this.phaseName;
    }

    // The name of a phase as a request, for a page that needs it before it can build its content.
    loadPhaseName(project: string, phaseID: string) {
      return this.http.get<any>('/api/fat-project/' + project + '/' + phaseID, this.authOptions()).pipe(
        map(data => this.phaseName = data[0].name as string)
      );
    }

    setPhaseName(project: string, phaseID: string, newName: string) {
      let data = {
        project: project,
        phaseID: phaseID,
        newName: newName,
      }
      
      httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
      console.log("HTTP: ", httpOptions);
      this.http.patch<any>('/api/fat-project/', data, httpOptions).subscribe(
        (data) => {
         console.log("SetPhaseName value ", data);
         this.phaseName = data;
       },
       (error) => {
         throw error;
       }
     );
     console.log("SERVICE PHASE: ", this.phaseName);
     return this.phaseName;
    }




    getPdfData(): Observable<any> {
      return this._pdfData.asObservable();
    }
  
    setPdfData(data: any) {
      this._pdfData.next(data);
    }
}