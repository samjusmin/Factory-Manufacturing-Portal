import { Component, Inject } from '@angular/core';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';

@Component({
    selector: 'message-dialog-box',
    templateUrl: './message-dialog-box.html',
    styleUrls: ['./message-dialog-box.css']
})
export class DialogBoxMessageComponent {

    form: FormGroup;
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: {message: string},
        private formBuilder: FormBuilder,
        private dialogRef: MatDialogRef<DialogBoxMessageComponent>
    ) {}

    ngOnInit() {
        this.dialogRef.updateSize('50%', '50%');
        this.form = this.formBuilder.group({
            message: this.data?.message,
        });
    }

    save() {
        this.dialogRef.close(this.form.value);
    }

    close() {
        this.dialogRef.close();
    }

}