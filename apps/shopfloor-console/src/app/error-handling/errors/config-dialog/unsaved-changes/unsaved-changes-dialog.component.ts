import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'unsaved-changes-dialog',
    templateUrl: 'unsaved-changes-dialog.component.html',
    styleUrls: ['./unsaved-changes-dialog.component.css'],
})
export class UnsavedChangesDialogComponent {

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: {
            message: string,
            title: string
        },
        private dialogRef: MatDialogRef<UnsavedChangesDialogComponent>
    ) {}

    ngOnInit() {
        console.log(this.data);
    }
    
}