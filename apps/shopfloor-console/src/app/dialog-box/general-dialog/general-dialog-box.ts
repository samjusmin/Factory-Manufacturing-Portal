import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
    selector: 'general-dialog-box',
    templateUrl: 'general-dialog-box.html',
    styleUrls: ['./general-dialog-box.css'],
})
export class GeneralDialogBoxComponent {

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: {
            message: string,
            title: string
        },
        private dialogRef: MatDialogRef<GeneralDialogBoxComponent>
    ) {}

    ngOnInit() {
        console.log(this.data);
    }
    
}