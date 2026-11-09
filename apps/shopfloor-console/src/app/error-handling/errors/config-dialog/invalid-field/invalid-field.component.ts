import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-invalid-field',
  templateUrl: './invalid-field.component.html',
  styleUrls: ['./invalid-field.component.css'],
})
export class InvalidFieldComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: { message: Array<string> }
  ) {}

  formatLabel(key: string): string {
    if (!key) return '';

    // replace underscores with spaces
    let formatted = key.replace(/_/g, ' ');

    // special case: prepend "PC" for model + image
    if (key === 'serial_no') return 'Serial Tag';
    if (key === 'model') return 'PC Model';
    if (key === 'pc_image') return 'PC Image';

    // capitalize each word
    formatted = formatted.replace(/\b\w/g, c => c.toUpperCase());

    return formatted;
  }
}