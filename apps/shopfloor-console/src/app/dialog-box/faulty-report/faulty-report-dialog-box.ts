import { MatTableDataSource } from '@angular/material/table';
import { Component, ElementRef, Inject } from '@angular/core';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MRPItemList, ReportList, SubProdOrder } from '@webproject/data';
import { ReplaySubject } from 'rxjs';

@Component({
    selector: 'faulty-report-dialog-box',
    templateUrl: './faulty-report-dialog-box.html',
    styleUrls: ['./faulty-report-dialog-box.css']
})
export class DialogBoxFaultyReportComponent {

    public descs: any = [];
    itemListControl = new FormControl('');
    items = this.data.itemList;
    form: FormGroup;
    faultyList: FormArray;
    reps = new MatTableDataSource<any>(this.data.rep as any);
    reportColumns = [];
    source = this.data.source;
    // filteredItems = this.data.itemList;
    public filteredItems: Array<SubProdOrder[]> = [];

    /**
     * Pre-defined columns for Reported items
     */
    itemColumns = [
        {
            id: 'item_no',
            value: 'Item No.'
        },
        {
            id: 'description',
            value: 'Description'
        },
        {
            id: 'qty_issue',
            value: 'Quantity'
        },
        {
            id: 'issue_type',
            value: 'Type'
        },
        {
            id: 'note',
            value: 'Notes'
        }
    ];

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: {itemList: SubProdOrder[], rep: ReportList, source: string, notes: string},
        private formBuilder: FormBuilder,
        private dialogRef: MatDialogRef<DialogBoxFaultyReportComponent>
    ) {}

    ngOnInit() {
        this.dialogRef.updateSize('70%', '80%');
        // this.filteredItems.next(this.items[].slice());

        this.form = this.formBuilder.group({
            report_type: new FormControl('', [Validators.required]),
            faultyList: this.formBuilder.array([ this.createItem() ]),
        }); 
        this.faultyList = this.form.get('faultyList') as FormArray;
        this.reportColumns = this.itemColumns.map((x) => x.id);
        this.filteredItems.push(this.data.itemList);
    }

    save() {
        this.dialogRef.close(this.form.value);
    }

    close() {
        this.dialogRef.close();
    }


    // COMMENT FOR GIT CHANGES

    showDescription(data: any, idx: number, source: string, item: any) {
        let itemIdx = data.value;

        if (source == "receiving") {
            this.faultyList.at(idx).get('desc').setValue(this.items[itemIdx].description, {emitEvent:false});
        } else {
            this.faultyList.at(idx).get('desc').setValue(this.items[itemIdx].items.description, {emitEvent:false});
        }

        this.filteredItems[idx] = this.data.itemList;
    }

    openedChange(data: any, idx: any) {
        //this.filteredItems = this.data.itemList;
        this.filteredItems[idx] = this.data.itemList;
    }

    createItem(): FormGroup {
        return this.formBuilder.group({
          item_no: ['', [Validators.required]],
          qty_issue: 0,
          desc: {value:'', disabled:true},
          note: ['']
        });
    }

    addRow(idx: any) {
        //this.filteredItems = this.data.itemList;
        this.filteredItems[idx] = this.data.itemList;
        this.faultyList = this.form.get('faultyList') as FormArray;
        this.faultyList.push(this.createItem());
    }

    removeRow(i: number) {
        this.faultyList.removeAt(i);
    }

    // Receive user input and send to search method**
    onKey(value, source, index) { 
        this.filteredItems[index] = this.search(value, source);
    }

    // Filter the items list and send back to populate the filteredItems**
    search(value: string, source: any) { 
        let filter = value.toLowerCase();
        let i = 0;

        let newFilteredList = [];


        if (source == "production") {
            for (var item of this.items) {
                if (item.items.item_no.toLowerCase().includes(filter) || item.items.description.toLowerCase().includes(filter)) {
                    newFilteredList.push(item)
                }
            }
        } else {
            for (var item of this.items) {
                if (item.item_no.toLowerCase().includes(filter) || item.description.toLowerCase().includes(filter)) {
                    newFilteredList.push(item)
                }
            }
        }
        return newFilteredList;
    }

    checkFiltered(item: any, index: any) {
        if (index == null) {
            index = 0;
        }
        if (this.filteredItems[index] != null) {
            if (this.filteredItems[index].includes(item)) {
                return true;
            } else {
                return false;
            }
        }
        
    }

}