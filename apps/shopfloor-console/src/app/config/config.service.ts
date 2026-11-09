import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { AuthInfoService } from '../auth/auth-info.service';

import {
  ConfigUnit,
  ConfigImages,
  HardwareType,
  IConfigCatalogue,
  IConfigCategory,
  IConfigCheck,
  IConfigLocation,
  IConfigType,
  IPcImage,
  SelectOption,
} from '@webproject/data';


const httpOptions = {
  headers: new HttpHeaders({
    Authorization: '',
  })
};

// What the Config pages share: the hardware catalogue (categories, types and their checklists), the locations and what
// each may use, the units of one type, a unit and its checklist, and the PC image and hardware model lists.
@Injectable({
    providedIn: 'root'
})

export class ConfigService {

  isLoaded = false;
  isAdmin = false;
  showError = false;
  // Set when a list could not be loaded, so the page can say so and offer to try again.
  loadError = false;
  // Set once the locations have arrived (the first page of Config shows them as tiles).
  locationsLoaded = false;
  // The same for the unit list, the image list and the hardware list.
  unitsLoaded = false;
  imagesLoaded = false;
  hardwareLoaded = false;
  imageList = new MatTableDataSource<ConfigImages>();

  // The hardware catalogue: what kinds of hardware exist and which types each has. Pages read it from here.
  catalogue: IConfigCatalogue = { categories: [] };
  catalogueLoaded = false;

  locationDatasource = new MatTableDataSource<IConfigLocation>();
  locationCategories = new Array<String>();
  locationCategoryTypes = new Array<String>();
  hardwareUnitsDatasource = new MatTableDataSource<ConfigUnit>();
  hardwareList = new MatTableDataSource<HardwareType>();

  constructor(
    private _location: Location,
    private http: HttpClient,
    public router: Router,
    public dialog: MatDialog,
    private authInfo: AuthInfoService,
  ) { }

  private authorise() {
    httpOptions.headers = httpOptions.headers.set('Authorization', 'Bearer ' + localStorage.getItem('token'));
  }

  // ---------- the hardware catalogue ----------

  getCatalogue(): Observable<IConfigCatalogue> {
    this.authorise();
    return this.http.get<IConfigCatalogue>('/api/config-catalogue', httpOptions).pipe(tap((c) => this.remember(c)));
  }

  private remember(catalogue: IConfigCatalogue) {
    this.catalogue = catalogue;
    this.catalogueLoaded = true;
  }

  category(name: string): IConfigCategory | undefined {
    return this.catalogue.categories.find((c) => c.name === name);
  }

  // The hardware types an image can be made for (types in categories that use a PC image).
  getImageTypes(): Observable<string[]> {
    this.authorise();
    return this.http.get<string[]>('/api/config-catalogue/image-types', httpOptions);
  }

  // A type with the checklist a new unit of it starts from.
  getCatalogueType(name: string): Observable<IConfigType> {
    this.authorise();
    return this.http.get<IConfigType>('/api/config-catalogue/types/' + encodeURIComponent(name), httpOptions);
  }

  createCategory(category: Partial<IConfigCategory>): Observable<IConfigCatalogue> {
    this.authorise();
    return this.http.post<IConfigCatalogue>('/api/config-catalogue/categories', category, httpOptions).pipe(tap((c) => this.remember(c)));
  }

  updateCategory(name: string, changes: Partial<IConfigCategory>): Observable<IConfigCatalogue> {
    this.authorise();
    return this.http.patch<IConfigCatalogue>('/api/config-catalogue/categories/' + encodeURIComponent(name), changes, httpOptions).pipe(tap((c) => this.remember(c)));
  }

  deleteCategory(name: string): Observable<IConfigCatalogue> {
    this.authorise();
    return this.http.delete<IConfigCatalogue>('/api/config-catalogue/categories/' + encodeURIComponent(name), httpOptions).pipe(tap((c) => this.remember(c)));
  }

  createType(type: { category: string; name: string }): Observable<IConfigCatalogue> {
    this.authorise();
    return this.http.post<IConfigCatalogue>('/api/config-catalogue/types', type, httpOptions).pipe(tap((c) => this.remember(c)));
  }

  deleteType(name: string): Observable<IConfigCatalogue> {
    this.authorise();
    return this.http.delete<IConfigCatalogue>('/api/config-catalogue/types/' + encodeURIComponent(name), httpOptions).pipe(tap((c) => this.remember(c)));
  }

  saveChecklist(name: string, checklist: IConfigCheck[]) {
    this.authorise();
    return this.http.patch<{ name: string; rows: number }>('/api/config-catalogue/types/' + encodeURIComponent(name) + '/checklist', { checklist }, httpOptions);
  }

  // ---------- locations ----------

  ///// GET ALL LOCATIONS /////
  async getAllLocations() {
    this.loadError = false;
    this.locationsLoaded = false;
    this.authorise();
    this.http
      .get<IConfigLocation[]>('/api/config-location/', httpOptions)
      .subscribe((res) => {
        this.locationDatasource.data = res;
        this.locationsLoaded = true;
        this.isLoaded = true;
      }, (error) => {
        this.loadError = true;
        throw error;
      });
  }

  // Admins read every location; other users may only read their own (the API enforces this).
  private locationsUrl(): string {
    return this.authInfo.isAdmin() ? '/api/config-location/' : '/api/config-location/mine';
  }

  // One location with what it may use (types, images, models, projects).
  getLocation(name: string): Observable<IConfigLocation | undefined> {
    this.authorise();
    return this.http.get<IConfigLocation[]>(this.locationsUrl(), httpOptions).pipe(map((all) => all.find((l) => l.location === name)));
  }

  ///// GET ALL CATEGORIES IN A LOCATIONS /////
  getLocationCategories(targetLocation: string) {
    this.locationCategories = [];
    this.loadError = false;
    this.locationsLoaded = false;
    this.authorise();
    this.http
      .get<IConfigLocation[]>(this.locationsUrl(), httpOptions)
      .subscribe((res) => {
        this.locationDatasource.data = res;
        this.locationsLoaded = true;
        this.isLoaded = true;

        const loc = this.locationDatasource.data.find(d => d.location === targetLocation);
        if (!loc || !Array.isArray(loc.item_access)) {
          this.locationCategories = [];
          return;
        }
        // Extract categories, dedupe, preserve order
        const seen = new Set<string>();
        for (const item of loc.item_access) {
          if (!seen.has(item.hardware_category)) {
            seen.add(item.hardware_category);
            this.locationCategories.push(item.hardware_category);
          }
        }
      }, (error) => {
        this.loadError = true;
        throw error;
      });
  }

  ///// GET ALL TYPES OF A CATEGORY IN A LOCATION /////
  getLocationCategoryTypes(targetLocation: string, targetCategory: string) {
    this.locationCategoryTypes = [];
    this.loadError = false;
    this.locationsLoaded = false;
    this.authorise();
    this.http
      .get<IConfigLocation[]>(this.locationsUrl(), httpOptions)
      .subscribe((res) => {
        this.locationDatasource.data = res;
        this.locationsLoaded = true;
        this.isLoaded = true;

        const loc = this.locationDatasource.data.find(d => d.location === targetLocation);
        if (!loc || !Array.isArray(loc.item_access)) {
          this.locationCategories = [];
          this.locationCategoryTypes = [];
          throw new Error(`Location not found or is invalid: '${targetLocation}'`);
        }

        // Find the category inside that location
        const cat = loc.item_access.find(i => i.hardware_category === targetCategory);
        if (!cat || !Array.isArray(cat.hardware_type)) {
          this.locationCategoryTypes = [];
          throw new Error(`Category not found or is inaccessible: '${targetCategory}'`);
        }

        // Return unique, order-preserving list of hardware types
        const seen = new Set<string>();
        const uniqueTypes = [];
        for (const t of cat.hardware_type) {
          if (!seen.has(t)) {
            seen.add(t);
            uniqueTypes.push(t);
          }
        }
        this.locationCategoryTypes = uniqueTypes;
      }, (error) => {
        this.loadError = true;
        throw error;
      });
  }

  addNewLocation(name: string) {
    this.authorise();
    return this.http.post<IConfigLocation>('/api/config-location/', { type: 'ENTRY', data: { location: name } }, httpOptions);
  }

  // Saves a location's Config / PC Image / Hardware access and its projects. Returns the request so callers can wait for it.
  updateLocItemAccess(updateLoc: IConfigLocation) {
    this.authorise();
    return this.http.patch<IConfigLocation>('/api/config-location/', { type: 'UPDATE', data: updateLoc }, httpOptions);
  }

  // ---------- units ----------

  ///// GET THE UNITS OF A HARDWARE TYPE AT A LOCATION /////
  getHardwareUnits(targetLocation: string, targetHardwareCategory: string, targetHardwareType: string) {
    this.loadError = false;
    this.unitsLoaded = false;
    this.hardwareUnitsDatasource.data = [];
    this.authorise();
    this.http
      .get<ConfigUnit[]>('/api/config-hardware/' + encodeURIComponent(targetLocation) + '/' + encodeURIComponent(targetHardwareCategory) + '/' + encodeURIComponent(targetHardwareType), httpOptions)
      .subscribe((res) => {
        this.hardwareUnitsDatasource.data = res;
        this.unitsLoaded = true;
        this.isLoaded = true;
      }, (error) => {
        this.loadError = true;
        throw error;
      });
  }

  // One unit with its checklist.
  getUnit(id: string): Observable<ConfigUnit> {
    this.authorise();
    return this.http.get<ConfigUnit>('/api/config-hardware/' + encodeURIComponent(id), httpOptions);
  }

  createUnit(payload: any): Observable<ConfigUnit> {
    this.authorise();
    return this.http.post<ConfigUnit>('/api/config-hardware', payload, httpOptions);
  }

  updateUnit(payload: any): Observable<ConfigUnit> {
    this.authorise();
    return this.http.patch<ConfigUnit>('/api/config-hardware', payload, httpOptions);
  }

  ///// PC IMAGES A LOCATION MAY USE FOR A HARDWARE TYPE /////
  getAccessibleImages(location: string, type: string) {
    this.authorise();
    return this.http.get<SelectOption[]>(
      `/api/config-location/${encodeURIComponent(location)}/${encodeURIComponent(type)}`,
      httpOptions
    );
  }

  ///// HARDWARE MODELS A LOCATION MAY USE FOR A CATEGORY /////
  getAccessibleHardware(location: string, category: string) {
    this.authorise();
    return this.http.get<SelectOption[]>(
      `/api/config-location/${encodeURIComponent(location)}/hardware/${encodeURIComponent(category)}`,
      httpOptions
    );
  }

  // ---------- images and hardware models ----------

  getImageList() {
    this.loadError = false;
    this.imagesLoaded = false;
    this.authorise();
    this.http
      .get<IPcImage[]>('/api/pc-image/', httpOptions)
      .subscribe((res) => {
        this.imageList.data = res;
        this.imagesLoaded = true;
      }, (error) => {
        this.loadError = true;
        throw error;
      });
    return this.imageList;
  }

  updateImageList(update: any) {
    this.authorise();
    return this.http.patch<any>('/api/pc-image/', {
      id: update._id,
      name: update.name,
      description: update.description,
      date_created: update.date_created_edit,
      added_by: update.added_by,
      responsible_person: update.responsible_person,
      pc_type: update.pc_type
    }, httpOptions);
  }

  getImageTree() {
    this.authorise();
    return this.http.get<IPcImage[]>(
      `/api/pc-image/tree`,
      httpOptions
    );
  }

  getHardwareList() {
    this.loadError = false;
    this.hardwareLoaded = false;
    this.authorise();
    this.http
      .get<HardwareType[]>('/api/hardware-type', httpOptions)
      .subscribe((res) => {
        this.hardwareList.data = res;
        this.hardwareLoaded = true;
      }, (error) => {
        this.loadError = true;
        throw error;
      });
    return this.hardwareList;
  }

  updateHardwareUnits(element: HardwareType) {
    this.authorise();
    return this.http.patch<HardwareType>('/api/hardware-type/', element, httpOptions);
  }

  getHardwareTypeList() {
    this.authorise();
    return this.http.get<any[]>(
      '/api/hardware-type/list',
      httpOptions
    );
  }

  goBack() {
    this._location.back();
  }

  // Whether the signed-in user is an administrator, from their sign-in (the API checks it again on every request).
  async checkIfAdmin() {
    this.isAdmin = this.authInfo.isAdmin();
    this.showError = !this.isAdmin;
    return this.isAdmin;
  }
}
