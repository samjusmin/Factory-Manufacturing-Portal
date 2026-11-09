import { Injectable, ViewChild  } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { DialogBoxMessageComponent } from '../dialog-box/message/message-dialog-box';

import {
  IPurchaseOrder, ReportList, POState, PODueBucket,
} from '@webproject/data';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ShippingDialogBoxConfirmationComponent } from '../dialog-box/shipping-confirmation/shipping-confirmation-dialog-box';
import { DialogBoxShortageReportComponent } from '../dialog-box/shortage-report/shortage-report-dialog-box';
import { GeneralDialogBoxComponent } from '../dialog-box/general-dialog/general-dialog-box';
import { DialogBoxFaultyReportComponent } from '../dialog-box/faulty-report/faulty-report-dialog-box';


const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

@Injectable({
    providedIn: 'root'
})

export class ReceivingTableService {

  public qtyreceiving:number[] = [];
  public message:string = '';
  postData: Array<{id: string, ref: string, no: string, key: string, line: number, line_key: string, qty:number}> = [];
  issuesData: Array<{item_no: string, revision: string, description: string, project: string, doc_no: string, qty_issue: number, issue_type: string, status: string, shp_ref: string}> = []
  emailData = { subject: '', message: '' };
  dataSource = new MatTableDataSource<IPurchaseOrder>();
  itemSource = [];
  itemLength = 0;
  isLoaded = false;
  renderer;
  isOrder = false;
  isReceiving = false;

  // List filters. The text search, status/bucket buttons and the overdue toggle all combine (AND).
  searchText = '';
  statusFilter: 'All' | POState = 'All';
  bucketFilter: 'All' | PODueBucket = 'All';
  overdueOnly = false;
  

  @ViewChild(MatSort) sort: MatSort;
  
  constructor(
    private _location: Location,
    private http: HttpClient, 
    public router: Router,
    public dialog: MatDialog,
    ) {}

  applyFilter(filterValue: string) {
    this.searchText = (filterValue || '').trim().toLowerCase();
    this.refilter();
  }

  setStatusFilter(status: 'All' | POState) {
    this.statusFilter = status;
    this.refilter();
  }

  setBucketFilter(bucket: 'All' | PODueBucket) {
    this.bucketFilter = bucket;
    this.refilter();
  }

  toggleOverdueOnly() {
    this.overdueOnly = !this.overdueOnly;
    this.refilter();
  }

  // Material only re-runs the predicate when the filter string changes, so encode every active filter in it.
  private refilter() {
    this.dataSource.filter = [this.searchText, this.statusFilter, this.bucketFilter, this.overdueOnly].join('|');
  }

  // Set once per data source (not on every keystroke).
  private setPredicate() {
    this.dataSource.filterPredicate = (data: IPurchaseOrder) => {
      const summary = data.summary;
      if (this.statusFilter !== 'All' && (!summary || summary.state !== this.statusFilter)) {
        return false;
      }
      if (this.bucketFilter !== 'All' && (!summary || summary.bucket !== this.bucketFilter)) {
        return false;
      }
      if (this.overdueOnly && !(summary && summary.overdue)) {
        return false;
      }
      if (!this.searchText) {
        return true;
      }
      const accumulator = (currentTerm, key) => this.nestedFilterCheck(currentTerm, data, key);
      return Object.keys(data).reduce(accumulator, '').toLowerCase().indexOf(this.searchText) !== -1;
    };
    // Sort the columns that show a derived value by that value.
    const stateOrder = { 'Open': 0, 'On order': 1, 'Partially received': 2, 'Received': 3 };
    this.dataSource.sortingDataAccessor = (data: IPurchaseOrder, header: string) => {
      switch (header) {
        case 'state': return data.summary ? stateOrder[data.summary.state] : -1;
        case 'progress': return data.summary ? data.summary.percent_received : 0;
        case 'open_lines': return data.summary ? data.summary.open_lines : 0;
        default: return data[header];
      }
    };
  }

  // How many orders each filter button would show, for the counts on the buttons.
  countByState(state: 'All' | POState): number {
    return this.dataSource.data.filter(po => state === 'All' || (po.summary && po.summary.state === state)).length;
  }

  countByBucket(bucket: 'All' | PODueBucket): number {
    return this.dataSource.data.filter(po => bucket === 'All' || (po.summary && po.summary.bucket === bucket)).length;
  }

  nestedFilterCheck(search, data, key) {
    if (typeof data[key] === 'object') {
      for (const k in data[key]) {
        if (data[key][k] !== null) {
          search = this.nestedFilterCheck(search, data[key], k);
        }
      }
    } else {
      search += data[key];
    }
    return search;
  }

  getAllReceiving() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
      .get<IPurchaseOrder[]>('/api/purchase-order', httpOptions)
      .subscribe((res) => {
        this.dataSource = new MatTableDataSource<IPurchaseOrder>(res);
        this.statusFilter = 'All';
        this.bucketFilter = 'All';
        this.overdueOnly = false;
        this.searchText = '';
        this.setPredicate();
        this.isLoaded = true;
      }, (error) => {
        throw error;
      });
  }

  getOrderReceiving() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
      .get<IPurchaseOrder[]>('/api/purchase-order/orders', httpOptions)
      .subscribe((res) => {
        this.dataSource = new MatTableDataSource<IPurchaseOrder>(res);
        this.statusFilter = 'All';
        this.bucketFilter = 'All';
        this.overdueOnly = false;
        this.searchText = '';
        this.setPredicate();
        this.isLoaded = true;
      }, (error) => {
        throw error;
      });
  }

  // readOnly = the Orders view of an order: head office also sees the lines at other locations.
  getReceivingOrder(poId: any, readOnly = false) {
    this.qtyreceiving = [];
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    this.http
    .get<IPurchaseOrder[]>('/api/purchase-order/' + (readOnly ? 'orders/' : '') + poId, httpOptions)
      .subscribe((res) => {
        this.itemLength = res.length ? res[0].items.length : 0;
        this.itemSource = res;
        this.isLoaded = true;
      }, (error) => {
        throw error;
      });
  }
  
  moveCell(e){
    const activeEle = document.activeElement.id;
    var elemName = activeEle.split("-");
    var len = elemName.length-1;
    var num = parseInt(elemName[len]);

    if (e.key == "ArrowDown" && num < this.itemLength-1) {
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

  goBack() {
    this._location.back();
  }

  onQtyComplete(shipRef: string) {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));

    console.log(this.qtyreceiving);

    for (var i = 0; i < this.itemLength; i++) {
      var element = this.qtyreceiving[i] === undefined ? 0 : this.qtyreceiving[i];
      if(element != 0) {
        this.postData.push({
          id: this.itemSource[0]._id,
          ref: shipRef,
          no: this.itemSource[0].doc_no,
          key: this.itemSource[0].key,
          line: this.itemSource[0].items[i].line_no, 
          line_key: this.itemSource[0].items[i].key,
          qty: element
        });
      }
    }
    console.log("Sending:", this.postData);
    this.http.post<any>('/api/purchase-order/', this.postData, httpOptions).subscribe((data) => {
        this.postData = [];
        this.qtyreceiving = [];
        location.reload();
    }, (error) => {
        this.postData = [];
        this.qtyreceiving = [];
        throw error;
    });
  }

  autoFill() {
    if (this.itemSource[0].owner == false) {
      this.itemSource[0].items.forEach((element, i) => {
        this.qtyreceiving[i] = element.qty_remaining;
      });
    }
    else {
      this.itemSource[0].items.forEach((element, i) => {
        if (element.prod_order == ' ') {
          this.qtyreceiving[i] = element.qty_remaining;
        }
        else {
          this.qtyreceiving[i] = 0;
        }
      });
    } 
  }

  openShortageDialog() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    let itemList = this.itemSource[0].items;
    let source = 'receiving';

    // Get existing faulty/shortage reports for this document
    this.http.get<ReportList[]>('/api/report-issues/' + this.itemSource[0].doc_no, httpOptions).subscribe((rep) => {
      console.log("Report:",rep); //need to open dialog box confirming message sent
      const dialogRef = this.dialog.open(DialogBoxFaultyReportComponent, {
        data: { itemList, rep, source }
      });
      dialogRef.afterClosed().subscribe(result => {
        if (result) {
  
          result.faultyList.forEach((element, i) => { 
            let issue = itemList[element.item_no];
            this.issuesData.push({
              item_no: issue.item_no,
              revision: issue.revision,
              description: issue.description,
              project: issue.project,
              doc_no: this.itemSource[0].doc_no,
              qty_issue: element.qty_issue,
              issue_type: result.report_type,
              status: 'Open',
              shp_ref: ''
            });
          })
  
          this.emailData.subject = "Notification for " + this.itemSource[0].doc_no;
          this.emailData.message = result.report_type.toUpperCase() + "items reported" + this.issuesData;
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
    // const dialogRef = this.dialog.open(DialogBoxShortageReportComponent, {
    //   data: { itemList }
    // });
  }

 openDialog() {
  const dialogRef = this.dialog.open(GeneralDialogBoxComponent,{
    data: { 
      title: "Report Submitted",
      message: "Thank you for submitting your report! The team will get back to you shortly." },
  });

  dialogRef.afterClosed().subscribe(result => {
    location.reload();
  });
}

  openConfirmationDialog() {
    const dialogRef = this.dialog.open(ShippingDialogBoxConfirmationComponent);

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.onQtyComplete(result.shipRef);
      }
    });
  }

  openEmailDialog() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
    const dialogRef = this.dialog.open(DialogBoxMessageComponent);
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.emailData.subject = "Notification for " + this.itemSource[0].doc_no;
        this.emailData.message = result.message;
        this.http.post<any>('/api/mail/', this.emailData, httpOptions).subscribe((data) => {
          console.log(data); //need to open dialog box confirming message sent
        }, (error) => {
          throw error;
        });
      }
    });
  }

}