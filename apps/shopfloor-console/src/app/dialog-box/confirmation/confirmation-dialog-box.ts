import { Component, Inject, Optional } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ConfirmationDialogData {
    title?: string;
    message?: string;
    confirmLabel?: string;
}

// Opened with no data it asks the original "post this change" question; pass data to ask something more specific.
@Component({
    selector: 'confirmation-dialog-box',
    templateUrl: 'confirmation-dialog-box.html',
})
export class DialogBoxConfirmationComponent {
    title = 'Confirm Update';
    message = 'Are you sure you want to post this change? This change cannot be reversed.';
    confirmLabel = 'OK';

    constructor(@Optional() @Inject(MAT_DIALOG_DATA) data: ConfirmationDialogData | null) {
        if (data) {
            this.title = data.title || this.title;
            this.message = data.message || this.message;
            this.confirmLabel = data.confirmLabel || this.confirmLabel;
        }
    }
}
