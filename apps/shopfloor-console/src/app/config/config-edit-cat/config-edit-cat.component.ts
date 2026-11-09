import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { IConfigCatalogueCategory } from '@webproject/data';
import { ConfigService } from '../config.service';
import { ConfigCatalogueDialogComponent, ICatalogueDialogData } from '../config-catalogue-dialog/config-catalogue-dialog.component';

// The hardware catalogue (administrators): every category and the types in it. Opening a type edits the checklist new
// units of that type start from; new types and categories are added here.
@Component({
  selector: 'webproject-config-edit-cat',
  templateUrl: './config-edit-cat.component.html'
})
export class ConfigEditCategoriesComponent implements OnInit {

  loaded = false;
  loadError = false;

  constructor(public ConfigService: ConfigService, private dialog: MatDialog, private snackBar: MatSnackBar) {
    ConfigService.isAdmin = false;
    ConfigService.showError = false;
  }

  ngOnInit(): void {
    this.ConfigService.checkIfAdmin();
    this.load();
  }

  load(): void {
    this.loadError = false;
    this.ConfigService.getCatalogue().subscribe(() => {
      this.loaded = true;
    }, () => {
      this.loadError = true;
      this.loaded = true;
    });
  }

  get groups(): IConfigCatalogueCategory[] {
    return this.ConfigService.catalogue.categories;
  }

  private open(data: ICatalogueDialogData, saved: string) {
    this.dialog.open(ConfigCatalogueDialogComponent, { data, width: '460px' }).afterClosed().subscribe(changed => {
      if (changed) {
        this.snackBar.open(saved, 'OK', { duration: 4000 });
      }
    });
  }

  addType(category?: IConfigCatalogueCategory): void {
    this.open({ mode: 'type', category }, 'Hardware type added. Open it to write its checklist.');
  }

  editCategory(category: IConfigCatalogueCategory): void {
    this.open({ mode: 'category', category }, 'Category saved.');
  }

  trackByCategory(index: number, group: IConfigCatalogueCategory): string {
    return group.name;
  }
}
