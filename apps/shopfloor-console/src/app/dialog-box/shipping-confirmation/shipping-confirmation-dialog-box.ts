import { ChangeDetectorRef, Component, Inject } from '@angular/core';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';

@Component({
    selector: 'shipping-confirmation-dialog-box',
    templateUrl: 'shipping-confirmation-dialog-box.html',
})
export class ShippingDialogBoxConfirmationComponent {

    shipForm: FormGroup;
    constructor(
        //@Inject(MAT_DIALOG_DATA) public data: {shipRef: string},
        private cdr: ChangeDetectorRef,
        private formBuilder: FormBuilder,
        private dialogRef: MatDialogRef<ShippingDialogBoxConfirmationComponent>
    ) {}

    ngOnInit() {
        this.dialogRef.updateSize('30%', '60%');
        this.shipForm = this.formBuilder.group({
            shipRef: "",
        });
    }

    ngAfterViewChecked(){
        this.cdr.detectChanges();
    }

    save() {
        this.dialogRef.close(this.shipForm.value);
    }

    close() {
        this.dialogRef.close();
    }

}