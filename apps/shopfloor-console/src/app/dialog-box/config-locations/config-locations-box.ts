import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfigService } from '../../config/config.service';
import { errorMessage } from '../../config/config-view';
import { HardwareTreeComponent } from './tabs/config-hardware-tree/hardware-tree.component';
import { PcImageTreeComponent } from './tabs/pc-image-tree/pc-image-tree.component';
import { HardwareTypeListComponent } from './tabs/hardware-type-list/hardware-type-list.component';
import { LocationProjectsComponent } from './tabs/location-projects/location-projects.component';

// A location's access (Config > Edit Locations): which hardware categories and types it can configure, which PC
// images it can pick, which hardware models, and which projects its units can be allocated to. One Save writes all
// four tabs.
@Component({
  selector: 'config-locations-box',
  templateUrl: './config-locations-box.html',
  styleUrls: ['./config-locations-box.css']
})
export class DialogBoxConfigLocationsComponent implements OnInit {

  @ViewChild(HardwareTreeComponent)
  hardwareTreeComponent!: HardwareTreeComponent;
  @ViewChild(PcImageTreeComponent)
  pcImageTreeComponent!: PcImageTreeComponent;
  @ViewChild(HardwareTypeListComponent)
  hardwareTypeListComponent!: HardwareTypeListComponent;
  @ViewChild(LocationProjectsComponent)
  locationProjectsComponent!: LocationProjectsComponent;

  saving = false;
  // Why the server refused the save (a type or project that units still use...); the dialog stays open to fix it.
  error = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public ConfigService: ConfigService,
    private dialogRef: MatDialogRef<DialogBoxConfigLocationsComponent>,
  ) {}

  ngOnInit() {
    this.dialogRef.updateSize('720px', 'auto');
    this.ConfigService.getImageList();
  }

  saveAll() {
    if (this.saving) {
      return;
    }

    // Every tab is drawn with the dialog, so each one reports what it holds.
    const itemAccessData = this.hardwareTreeComponent ? this.hardwareTreeComponent.getFormattedLocationAccess() : null;
    const imageAccessData = this.pcImageTreeComponent ? this.pcImageTreeComponent.getFormattedImageAccess() : null;
    const hardwareAccessData = this.hardwareTypeListComponent ? this.hardwareTypeListComponent.getFormattedHardwareAccess() : null;
    const projectsData = this.locationProjectsComponent ? this.locationProjectsComponent.getFormattedProjects() : null;

    const finalPayload: any = { location: this.data.location };
    if (itemAccessData) {
      finalPayload.item_access = itemAccessData.item_access;
    }
    if (imageAccessData) {
      finalPayload.image_access = imageAccessData.image_access;
    }
    if (hardwareAccessData) {
      finalPayload.hardware_access = hardwareAccessData.hardware_access;
    }
    if (projectsData) {
      finalPayload.projects = projectsData.projects;
    }

    this.error = '';
    this.saving = true;
    this.ConfigService.updateLocItemAccess(finalPayload).subscribe(() => {
      // Refresh the list only once the server has the new access, so reopening a location shows it.
      this.ConfigService.getAllLocations();
      this.dialogRef.close();
    }, (error) => {
      this.saving = false;
      if (error && error.status === 401) {
        throw error;
      }
      this.error = errorMessage(error, 'That could not be saved. Please try again.');
    });
  }

  close() {
    this.dialogRef.close();
  }
}
