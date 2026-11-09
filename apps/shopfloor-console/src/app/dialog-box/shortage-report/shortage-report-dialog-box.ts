import { MatTableDataSource } from '@angular/material/table';
import { Component, ElementRef, Inject } from '@angular/core';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { ReportList, SubProdOrder } from '@webproject/data';

@Component({
    selector: 'shortage-report-dialog-box',
    templateUrl: './shortage-report-dialog-box.html',
    styleUrls: ['./shortage-report-dialog-box.css']
})
export class DialogBoxShortageReportComponent {

    public descs: any = [];
    itemListControl = new FormControl('');
    items = this.data.itemList;
    reps = new MatTableDataSource<any>(this.data.rep as any);
    form: FormGroup;
    faultyList: FormArray;

    reportColumns = [];

    /**
     * Pre-defined columns for Reported items
     */
    itemColumns = [
        {
        id: 'description',
        value: 'Description'
        },
        {
        id: 'qty_issue',
        value: 'Quantity'
        }
    ];

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: {itemList: SubProdOrder, rep: ReportList},
        private formBuilder: FormBuilder,
        private dialogRef: MatDialogRef<DialogBoxShortageReportComponent>
    ) {}

    ngOnInit() {
        this.dialogRef.updateSize('70%', '80%');
        
        console.log("Test", this.items);

        this.form = this.formBuilder.group({
            faultyList: this.formBuilder.array([ this.createItem() ])
        }); 
        this.faultyList = this.form.get('faultyList') as FormArray;
        this.reportColumns = this.itemColumns.map((x) => x.id);
    }

    save() {
        //console.log(this.form.value);
        this.dialogRef.close(this.form.value);
    }

    close() {
        this.dialogRef.close();
    }

    showDescription(data: any, idx: number) {
        let itemIdx = data.value;
        console.log(this.form.value);
        this.faultyList.at(idx).get('desc').setValue(this.items[itemIdx].description);
        // this.descs[idx] = this.items[itemIdx].items.description;
        // console.log("Selection change: ", this.descs[idx]);
    }

    createItem(): FormGroup {
        return this.formBuilder.group({
          item_no: '',
          qty_issue: 0,
          desc: {value:'', disabled:true},
        });
    }

    addRow() {
        this.faultyList = this.form.get('faultyList') as FormArray;
        this.faultyList.push(this.createItem());
    }

}