import { ElementRef, Injectable, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { DialogBoxConfirmationComponent } from '../dialog-box/confirmation/confirmation-dialog-box';
import { DialogBoxMessageComponent } from '../dialog-box/message/message-dialog-box';
import { DialogBoxFaultyReportComponent } from '../dialog-box/faulty-report/faulty-report-dialog-box';

import {
    MainProdOrder,
    SubProdOrder,
    IProdOrder,
    ReportList,
    ProdState
} from '@webproject/data';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort, Sort } from '@angular/material/sort';
import { GeneralDialogBoxComponent } from '../dialog-box/general-dialog/general-dialog-box';

const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

@Injectable({
    providedIn: 'root'
})

export class ProdTableService {

  public qtycomplete: any = [];
  //public hasComps: any = [];
  postData: Array<{type: string, id: string, doc_no: string, parent_ref: number, line: number, item_no: string, project: string, location: string, variant: string, qty:number}> = [];
  issuesData: Array<{item_no: string, revision: string, description: string, project: string, doc_no: string, qty_issue: number, issue_type: string, status: string, shp_ref: string, note: string}> = []
  emailData = { subject: '', message: '' };
  layer = "none";
  mrpSource = new MatTableDataSource<MainProdOrder>();
  childSource = new MatTableDataSource<SubProdOrder>();
  childLength = 0;
  isLoaded = false;
  renderer;

  
  constructor(
    private _location: Location,
    private http: HttpClient,
    public router: Router,
    public dialog: MatDialog,
  ) { }

  // List filters. The text search, the status buttons and the overdue toggle all combine (AND).
  searchText = '';
  statusFilter: 'All' | ProdState = 'All';
  overdueOnly = false;

  applyFilter(filterValue: string) {
    this.searchText = (filterValue || '').trim().toLowerCase();
    this.refilter();
  }

  setStatusFilter(status: 'All' | ProdState) {
    this.statusFilter = status;
    this.refilter();
  }

  toggleOverdueOnly() {
    this.overdueOnly = !this.overdueOnly;
    this.refilter();
  }

  // Material only re-runs the predicate when the filter string changes, so encode every active filter in it.
  private refilter() {
    this.mrpSource.filter = [this.searchText, this.statusFilter, this.overdueOnly].join('|');
  }

  // How many orders each filter button would show, for the counts on the buttons.
  countByState(state: 'All' | ProdState): number {
    return this.mrpSource.data.filter(o => state === 'All' || (o.summary && o.summary.state === state)).length;
  }

  private setPredicate() {
    this.mrpSource.filterPredicate = (data: MainProdOrder) => {
      const summary = data.summary;
      if (this.statusFilter !== 'All' && (!summary || summary.state !== this.statusFilter)) {
        return false;
      }
      if (this.overdueOnly && !(summary && summary.overdue)) {
        return false;
      }
      if (!this.searchText) {
        return true;
      }
      const haystack = [
        data.doc_no, data.description, data.project, data.location,
        ...(data.items || []).map(i => i.item_no),
        ...(data.result || []).map(r => r.doc_no),
      ].join(' ').toLowerCase();
      return haystack.indexOf(this.searchText) !== -1;
    };
  }

  @ViewChild(MatSort) sort: MatSort;

  getAllAssemblies() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
        .get<MainProdOrder[]>('/api/prod-order/', httpOptions)
        .subscribe((res) => {
          this.mrpSource = new MatTableDataSource<MainProdOrder>(res);
          this.statusFilter = 'All';
          this.overdueOnly = false;
          this.searchText = '';
          this.setPredicate();
          this.mrpSource.sortingDataAccessor = (data: any, sortHeaderId: string) => {
            // The item and PO columns show values that live inside nested lists.
            if (sortHeaderId === 'item_no') {
              return (data.items && data.items[0] && data.items[0].item_no) || '';
            }
            const stateOrder = { 'Not started': 0, 'In progress': 1, 'Completed': 2 };
            if (sortHeaderId === 'state') {
              return data.summary ? stateOrder[data.summary.state] : -1;
            }
            if (sortHeaderId === 'progress') {
              return data.summary ? data.summary.percent_complete : 0;
            }
            if (sortHeaderId === 'result') {
              return (data.result && data.result[0] && data.result[0].doc_no) || '';
            }
            return this.getPropertyByPath(data, sortHeaderId);
          };
          this.mrpSource.sort = this.sort;
          this.isLoaded = true;
        }, (error) => {
          throw error;
        }
    );
  }

  getPropertyByPath(obj: Object, pathString: string) {
    return pathString.split('.').reduce((o, i) => (o === undefined || o === null ? o : o[i]), obj);
  }

  getSubAssembly(mrpID: any) {
    //this.hasComps = [];
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
    .get<SubProdOrder[]>('/api/prod-order/' + mrpID, httpOptions)
      .subscribe((res) => {
        this.childLength = res.length;
        this.childSource = new MatTableDataSource<SubProdOrder>(res);
        this.childSource.sortingDataAccessor = (data, sortHeaderId: string) => {
          return this.getPropertyByPath(data, sortHeaderId);
        };
        this.childSource.sort = this.sort;
        //this.hasComps = this.childSource.data[0].parents.map(a => a.parent_ref);
        this.isLoaded = true;
      },
      (error) => {
        throw error;
      });
  }

  getComponents(mrpID: any, lineID: any) {
    this.qtycomplete = [];
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
    .get<SubProdOrder[]>('/api/prod-order/' + mrpID + '/' + lineID, httpOptions)
      .subscribe((res) => {
        this.childLength = res.length;
        this.childSource = new MatTableDataSource<SubProdOrder>(res);
        
        this.childSource.sortingDataAccessor = (item, property) => {
          switch (property) {
            case 'result': {
              if (!item.result[0]) {
                return 9999999999999;
              }
              else {
                return item.result[0]['doc_no'];
              }
            }
            case 'vendor': {
              if (!item.result[0]) {
                return 9999999999999;
              }
              else {
                return item.result[0][property];
              }
            }
            case 'stock': {
              return item.stock[0]['inventory'];
            }
            default: { return item.items[property];  }
          }
        };
        
        this.childSource.filterPredicate = (data: SubProdOrder, filter: string) => {
          return data.items.item_no.toLowerCase().includes(filter) || data.items.description.toLowerCase().includes(filter);
        };

        this.isLoaded = true;
      },
      (error) => {
        throw error;
      });
  }

  refreshComponents(mrpID: any, lineID: any) {
    this.qtycomplete = [];
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
    .get<SubProdOrder[]>('/api/prod-order/' + mrpID + '/' + lineID + '/' + "refresh", httpOptions)
      .subscribe((res) => {
        this.childLength = res.length;
        this.childSource = new MatTableDataSource<SubProdOrder>(res);
        
        this.childSource.sortingDataAccessor = (item, property) => {
          switch (property) {
            case 'result': {
              if (!item.result[0]) {
                return 9999999999999;
              }
              else {
                return item.result[0]['doc_no'];
              }
            }
            case 'vendor': {
              if (!item.result[0]) {
                return 9999999999999;
              }
              else {
                return item.result[0][property];
              }
            }
            case 'stock': {
              return item.stock[0]['inventory'];
            }
            default: { return item.items[property];  }
          }
        };
        
        this.childSource.filterPredicate = (data: SubProdOrder, filter: string) => {
          return data.items.item_no.toLowerCase().includes(filter) || data.items.description.toLowerCase().includes(filter);
        };

        this.isLoaded = true;
      },
      (error) => {
        throw error;
      });
  }

  // Enable navigating through input fields using up and down arrow keys
  moveCell(e){
    const activeEle = document.activeElement.id;
    var elemName = activeEle.split("-");
    var len = elemName.length-1;
    var num = parseInt(elemName[len]);

    if (e.key == "ArrowDown" && num < this.childLength-1) {
      elemName[len] = String(num+1);
      var next = elemName.join("-");
      const element = this.renderer.selectRootElement("#" + next);
      setTimeout(() => element.focus(), 0);
    }
    else if (e.key == "ArrowUp" && num > 0) {
      elemName[len] = String(num-1);
      var next = elemName.join("-");
      const element = this.renderer.selectRootElement("#" + next);
      setTimeout(() => element.focus(), 0);
    }
  }

  findComps(parent, line) { 
    return parent.findIndex(x => x.parent_ref === line);
  }

  goBack() {
    this._location.back();
  }

  onQtyComplete() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    //this.qtycomplete.forEach( (element, index) => {
    this.childSource.data.forEach( (element, index) => {
      if (element.items.qty_to_receive > 0) {
        this.postData.push({
          type: "consumption",
          id: element._id,
          doc_no: element.doc_no,
          parent_ref: element.parent_ref, 
          line: element.items.line_no,
          item_no: element.items.item_no,
          variant: element.items.revision,
          project: element.items.project,
          location: element.items.location,
          qty: element.items.qty_to_receive
        });
      }
    });
    this.http.post<any>('/api/prod-order/', this.postData, httpOptions).subscribe(
      (data) => {
         console.log("POST call successful value returned in body", data);
         this.postData = [];
         this.qtycomplete = [];
         location.reload();
      },
      (error) => {
        this.postData = [];
        this.qtycomplete = [];
        throw error;
      }
    )
  }

  onQtyOutput() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.qtycomplete.forEach( (element, index) => {
      this.postData.push({
        type: "output",
        id: this.childSource.data[0]._id,
        doc_no: this.childSource.data[0].doc_no,
        parent_ref: this.childSource.data[0].parent_ref, 
        line: this.childSource.data[index].items.line_no,
        item_no: this.childSource.data[index].items.item_no,
        variant: this.childSource.data[index].items.revision,
        project: this.childSource.data[index].items.project,
        location: this.childSource.data[index].items.location,
        qty: element
      });
    });
    this.http.post<any>('/api/prod-order/', this.postData, httpOptions).subscribe(
      (data) => {
         console.log("POST call successful value returned in body", data);
         this.postData = [];
         this.qtycomplete = [];
         location.reload();
      },
      (error) => {
        this.postData = [];
        this.qtycomplete = [];
        throw error;
      }
    )
  }

  autoFill() {
    this.childSource.data.forEach((element, i) => {
      console.log("HERE IS THE ELEMENT");
      console.log(element);
      //console.log(element['stock'][0].inventory);
      if (element['stock'].length > 0 && element.items.qty_remaining <= element['stock'][0].inventory) {
        console.log(element['stock'][0].inventory);
        element.items.qty_to_receive = element.items.qty_remaining;
      } 
      else if (element['stock'].length > 0 && element.items.qty_remaining > element['stock'][0].inventory) {
        element.items.qty_to_receive = element['stock'][0].inventory;
      }
    });
  }

  autoFillQty(x: number) {
    this.childSource.data.forEach((element, i) => {
      element.items.qty_to_receive = element.items.qty_per * x;
    });
  }

  openConfirmationDialog() {
    const dialogRef = this.dialog.open(DialogBoxConfirmationComponent);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.onQtyComplete();
      }
    });
  }

  // openEmailDialog() {
  //   httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
  //   let initMessage = this.childSource.data[0].doc_no + '\r\n';
  //   this.childSource.data.forEach(element => {
  //     initMessage += element.items.qty + ' x ' + element.items.item_no + ' completed\r\n'
  //   });
  //   const dialogRef = this.dialog.open(DialogBoxMessageComponent,{
  //     data: { message: initMessage },
  //   });
  //   dialogRef.afterClosed().subscribe(result => {
  //     if (result) {
  //       this.emailData.subject = "Notification for " + this.childSource.data[0].doc_no;
  //       this.emailData.message = result.message;
  //       this.http.post<any>('/api/mail/', this.emailData, httpOptions).subscribe((data) => {
  //         console.log(data); //need to open dialog box saying message sent
  //       }, (error) => {
  //         throw error;
  //       });
  //     }
  //   });
  // }

  // openEmailDialog() {
  //   const dialogRef = this.dialog.open(DialogBoxFaultyReportComponent, {
  //     data: { itemList: this.childSource.data }
  //   });

  //   dialogRef.afterClosed().subscribe(result => {
  //     if (result) {
  //       result.faultyList.forEach((element, i) => { 
  //         this.childSource.data[element.item_no]
  //       })
  //     }
  //   });
  // }
  
  openDialog() {
    const dialogRef = this.dialog.open(GeneralDialogBoxComponent,{
      data: { 
        title: "Report Submitted",
        message: "Thank you for submitting the report! The team will get back to you shortly." },
    });

    dialogRef.afterClosed().subscribe(result => {
      location.reload();
    });
  }

  openShortageDialog() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    let itemList = this.childSource.data;
    let source = 'production';

    this.http.get<ReportList[]>('/api/report-issues/' + this.childSource.data[0].doc_no, httpOptions).subscribe((rep) => {
      const reportRef = this.dialog.open(DialogBoxFaultyReportComponent, {
        data: { itemList, rep, source }
      });
      reportRef.afterClosed().subscribe(result => {
        if (result) {
          result.faultyList.forEach((element, i) => { 
            let issue = itemList[element.item_no];
            this.issuesData.push({
              item_no: issue.items.item_no,
              revision: issue.items.revision,
              description: issue.items.description,
              project: issue.items.project,
              doc_no: issue.doc_no,
              qty_issue: element.qty_issue,
              issue_type: result.report_type,
              status: 'Open',
              shp_ref: '',
              note: element.note
            });
          })

          this.emailData.subject = "Notification for " + this.childSource.data[0].doc_no;
          this.emailData.message = result.report_type.toUpperCase() + "items reported " + this.issuesData;
        
          this.http.post<any>('/api/report-issues/', this.issuesData, httpOptions).subscribe((data) => {
            this.openDialog();
          }, (error) => {
            throw error;
          });
        }
      });
    }, (error) => {
      throw error;
    });
  }

}