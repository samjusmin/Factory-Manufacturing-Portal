import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { IConfigCatalogue, IConfigCatalogueCategory } from '@webproject/data';
import { ConfigService } from '../config.service';
import { CATEGORY_ICONS, errorMessage } from '../config-view';
import { DialogBoxConfirmationComponent } from '../../dialog-box/confirmation/confirmation-dialog-box';

export interface ICatalogueDialogData {
  // 'type' adds a hardware type (in an existing category, or a new one); 'category' changes one category.
  mode: 'type' | 'category';
  // The category being changed, or the one a new type starts in.
  category?: IConfigCatalogueCategory;
}

// The value of the category choice that means "make a new category".
export const NEW_CATEGORY = '__new__';

// Part names typed one per line or separated by commas.
export function parsePartNames(text: string): string[] {
  return String(text || '').split(/[\n,]/).map(p => p.trim().replace(/\s+/g, ' ')).filter(p => p);
}

// Adds a hardware type, or changes what a category looks like (its icon, whether its units have a PC image, which
// parts they have). Closes with true once the change has been saved.
@Component({
  selector: 'webproject-config-catalogue-dialog',
  templateUrl: './config-catalogue-dialog.component.html'
})
export class ConfigCatalogueDialogComponent {

  readonly icons = CATEGORY_ICONS;
  readonly newCategory = NEW_CATEGORY;

  form: FormGroup;
  saving = false;
  error = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ICatalogueDialogData,
    private dialogRef: MatDialogRef<ConfigCatalogueDialogComponent, boolean>,
    private fb: FormBuilder,
    private dialog: MatDialog,
    public ConfigService: ConfigService,
  ) {
    const category = data.category;
    const first = this.categories[0];
    this.form = this.fb.group({
      category: [category ? category.name : (first ? first.name : NEW_CATEGORY)],
      name: [''],
      newName: [''],
      icon: [category ? category.icon : 'box-open'],
      uses_image: [category ? category.uses_image : false],
      parts: [category ? category.parts.join('\n') : ''],
    });
  }

  get isType(): boolean {
    return this.data.mode === 'type';
  }

  get categories(): IConfigCatalogueCategory[] {
    return this.ConfigService.catalogue.categories;
  }

  // Whether the category fields (icon, PC image, parts) are shown: when changing a category or making a new one.
  get showsCategoryFields(): boolean {
    return !this.isType || this.form.value.category === NEW_CATEGORY;
  }

  get canDeleteCategory(): boolean {
    return !this.isType && !!this.data.category && !this.data.category.types.length;
  }

  private categoryFields() {
    const value = this.form.value;
    return { icon: value.icon, uses_image: !!value.uses_image, parts: parsePartNames(value.parts) };
  }

  save(): void {
    if (this.saving) {
      return;
    }
    const value = this.form.value;
    let request: Observable<IConfigCatalogue>;
    if (!this.isType) {
      request = this.ConfigService.updateCategory(this.data.category.name, this.categoryFields());
    } else {
      const name = String(value.name || '').trim();
      const newName = String(value.newName || '').trim();
      if (value.category === NEW_CATEGORY && !newName) {
        this.error = 'Give the new category a name.';
        return;
      }
      if (!name) {
        this.error = 'Give the hardware type a name.';
        return;
      }
      const category = value.category === NEW_CATEGORY ? newName : value.category;
      const create = () => this.ConfigService.createType({ category, name });
      request = value.category === NEW_CATEGORY
        ? new Observable<IConfigCatalogue>(subscriber => {
            this.ConfigService.createCategory({ name: newName, ...this.categoryFields() }).subscribe(
              () => create().subscribe(c => { subscriber.next(c); subscriber.complete(); }, e => subscriber.error(e)),
              e => subscriber.error(e));
          })
        : create();
    }
    this.error = '';
    this.saving = true;
    request.subscribe(
      () => this.dialogRef.close(true),
      (error) => {
        this.saving = false;
        if (error && error.status === 401) {
          throw error;
        }
        this.error = errorMessage(error, 'That could not be saved. Please try again.');
      }
    );
  }

  deleteCategory(): void {
    this.dialog.open(DialogBoxConfirmationComponent, {
      data: {
        title: 'Delete category',
        message: `Delete the category ${this.data.category.name}? It has no hardware types.`,
        confirmLabel: 'Delete',
      }
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) {
        return;
      }
      this.saving = true;
      this.ConfigService.deleteCategory(this.data.category.name).subscribe(
        () => this.dialogRef.close(true),
        (error) => {
          this.saving = false;
          if (error && error.status === 401) {
            throw error;
          }
          this.error = errorMessage(error, 'That could not be deleted.');
        }
      );
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
