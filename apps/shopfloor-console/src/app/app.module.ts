import { NgModule } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { Routes, RouterModule } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FilterPickerComponent } from './fat/filter-picker/filter-picker.component';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTabsModule } from '@angular/material/tabs';

import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { ReceivingTableComponent } from './receiving-list-table/receiving-table/receiving-table.component';
import { ReceivingDetailTableComponent } from './receiving-list-table/receiving-detail-table/receiving-detail-table.component';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { ProdTableComponent } from './prod-table/prod-list-table/prod-table.component';
import { ProdSubassemblyTableComponent } from './prod-table/prod-subassembly-table/prod-subassembly-table.component';
import { ProdComponentTableComponent } from './prod-table/prod-component-table/prod-component-table.component';
import { TrainingLocationsComponent } from './training/training-locations/training-locations.component';
import { TrainingLocationComponent } from './training/training-location/training-location.component';
import { TrainingUserComponent } from './training/training-user/training-user.component';

import { StockkeepingComponent } from './stockkeeping/stockkeeping.component';
import { LoginComponent } from './login/login.component';

import { MatDialogModule } from '@angular/material/dialog';
import { DialogBoxConfirmationComponent } from './dialog-box/confirmation/confirmation-dialog-box';
import { DialogBoxShortageReportComponent } from './dialog-box/shortage-report/shortage-report-dialog-box';
import { DialogBoxFaultyReportComponent } from './dialog-box/faulty-report/faulty-report-dialog-box';
import { DialogBoxMessageComponent } from './dialog-box/message/message-dialog-box';
import { ShippingDialogBoxConfirmationComponent } from './dialog-box/shipping-confirmation/shipping-confirmation-dialog-box';
import { DialogBoxChangeLocationComponent } from './dialog-box/change-location/change-location-dialog-box';
import { GeneralDialogBoxComponent } from './dialog-box/general-dialog/general-dialog-box';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatCardModule } from '@angular/material/card';
import { DialogBoxConfigLocationsComponent } from './dialog-box/config-locations/config-locations-box';

import { MaxAmountDirective } from './validator/max-amount-validator.directive';
import { ResizeColumnDirective } from './validator/resize-column.directive';

import { FontAwesomeModule, FaIconLibrary  } from '@fortawesome/angular-fontawesome';
import { faPlus, faBoxOpen, faTools, faCubes, faUser, faChevronCircleLeft, faSave, faEnvelope, faAngleRight, faFileInvoice, faCheckSquare, faDumbbell, faPencilAlt, faCheck, faTimes, faSync, faTrash, faCogs, faDesktop, faChevronCircleRight, faChevronDown, faChevronRight, faHome, faWarehouse, faArrowRight, faSignOutAlt, faFileExport, faComments, faClipboardList, faSearch, faChevronUp, faFilter, faUsers } from '@fortawesome/free-solid-svg-icons';

import { ErrorModule } from './error/error.module';
import { ErrorHandlingModule } from './error-handling/error-handling.module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PurchaseOrderComponent } from './receiving-list-table/purchase-order/purchase-order.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { NotFoundComponent } from './not-found/not-found.component';
import { FATUnitCatComponent } from './fat/fat-unit-cat/fat-unit-cat.component';
import { FATAddPhaseComponent } from './fat/fat-add-phase/fat-add-phase.component';
import { FATUnitEntryComponent } from './fat/fat-unit-entry/fat-unit-entry.component';
import { FATUnitChecklistComponent } from './fat/fat-unit-checklist/fat-unit-checklist.component';
import { UnsavedChangesGuard } from './fat/unsaved-changes.guard';
import { FATProjectListComponent } from './fat/fat-project-list/fat-project-list.component';
import { FATProjectPhaseComponent } from './fat/fat-project-phase/fat-project-phase.component';
import { FATUnitListComponent } from './fat/fat-unit-list/fat-unit-list.component';
import { FATAddUnitComponent } from './fat/fat-add-unit/fat-add-unit.component';
import { FATMoveUnitsComponent } from './fat/fat-move-units/fat-move-units.component';
import { FATSerialNumberComponent } from './fat/fat-serial-lookup/fat-serial-lookup.component';
import { FATEditCategoriesComponent } from './fat/fat-edit-cat/fat-edit-cat.component';
import { FATEditChecklistComponent } from './fat/fat-edit-checklist/fat-edit-checklist.component';
import { FATAddChecklistComponent } from './fat/fat-add-checklist/fat-add-checklist.component';
import { FATPhaseCommentsComponent } from './fat/fat-phase-comments/fat-phase-comments.component';
import { FATRestrictedAccess } from './fat/fat-restricted-accesss/fat-restricted-access';
import { SidenavComponent } from './sidenav/sidenav.component';
import { FatPdfSelectUnitsComponent } from './fat/fat-pdf/fat-pdf-select-units/fat-pdf-select-units.component';
import { FatPdfResultComponent } from './fat/fat-pdf/fat-pdf-result/fat-pdf-result.component';
import { ConfigImageListComponent } from './config/config-image-list/config-image-list.component';
import { ConfigEditCategoriesComponent } from './config/config-edit-cat/config-edit-cat.component';
import { ConfigEditChecklistComponent } from './config/config-edit-checklist/config-edit-checklist.component';
import { TableSortDirective } from './shared/table-sort.directive';
import { ConfigAdminComponent } from './config/config-admin/config-admin.component';
import { ConfigCategoriesComponent } from './config/config-categories/config-categories.component';
import { ConfigTypeComponent } from './config/config-type/config-type.component';
import { ConfigRestrictedAccess } from './config/config-restricted-access/config-restricted-access';
import { ConfigLocationsComponent } from './config/config-locations/config-locations.component';
import { HardwareTreeComponent } from './dialog-box/config-locations/tabs/config-hardware-tree/hardware-tree.component';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { ConfigUnitComponent } from './config/config-unit/config-unit.component';
import { ListFiltersComponent } from './shared/list-filters/list-filters.component';
import { ConfigUnitFormComponent } from './config/config-unit-form/config-unit-form.component';
import { ConfigCatalogueDialogComponent } from './config/config-catalogue-dialog/config-catalogue-dialog.component';
import { LocationProjectsComponent } from './dialog-box/config-locations/tabs/location-projects/location-projects.component';
import { InvalidFieldComponent } from './error-handling/errors/config-dialog/invalid-field/invalid-field.component';
import { UnsavedChangesDialogComponent } from './error-handling/errors/config-dialog/unsaved-changes/unsaved-changes-dialog.component';
import { PcImageTreeComponent } from './dialog-box/config-locations/tabs/pc-image-tree/pc-image-tree.component';
import { ConfigHardwareListComponent } from './config/config-hardware-list/config-hardware-list.component';
import { HardwareTypeListComponent } from './dialog-box/config-locations/tabs/hardware-type-list/hardware-type-list.component';
import { HomeComponent } from './home/home.component';
import { AdminGuard, AreaGuard, LocationGuard } from './auth/config-access.guard';

const routes: Routes = [
  // Receiving is the work list of orders to book in; Orders is the read-only tracker of every purchase order.
  { path: 'receiving', component: ReceivingTableComponent, canActivate: [AreaGuard], data: { mode: 'receiving', area: 'warehouse' } },
  { path: 'orders', component: ReceivingTableComponent, canActivate: [AreaGuard], data: { mode: 'orders', area: 'warehouse' } },
  { path: 'receiving/:poId', component: ReceivingDetailTableComponent, canActivate: [AreaGuard], data: { area: 'warehouse' } },
  { path: 'orders/:poId', component: ReceivingDetailTableComponent, canActivate: [AreaGuard], data: { readOnly: true, area: 'warehouse' } },
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'prod-order', component: ProdTableComponent, canActivate: [AreaGuard], data: { area: 'warehouse' } },
  { path: 'prod-order/:mrpId', component: ProdSubassemblyTableComponent, canActivate: [AreaGuard], data: { area: 'warehouse' } },
  { path: 'prod-order/:mrpId/:lineId', component: ProdComponentTableComponent, canActivate: [AreaGuard], data: { area: 'warehouse' } },
  { path: 'stockkeeping', component: StockkeepingComponent, canActivate: [AreaGuard], data: { area: 'warehouse' } },
  { path: 'FAT-project-list', component: FATProjectListComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'FAT-add-phase/:project', component: FATAddPhaseComponent, canActivate: [AreaGuard], data: { area: 'fat' }, canDeactivate: [UnsavedChangesGuard] },
  { path: 'FAT-unit-cat/:project/:phase/:unit', component: FATUnitCatComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'FAT-unit-checklist/:project/:phase/:unit/:category', component: FATUnitChecklistComponent, canActivate: [AreaGuard], data: { area: 'fat' }, canDeactivate: [UnsavedChangesGuard] },
  { path: 'FAT-project-phase/:project', component: FATProjectPhaseComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'FAT-unit-list/:project/:phase', component: FATUnitListComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'FAT-add-unit/:project/:phase', component: FATAddUnitComponent, canActivate: [AreaGuard], data: { area: 'fat' }, canDeactivate: [UnsavedChangesGuard] },
  { path: 'FAT-move-units/:project', component: FATMoveUnitsComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'FAT-serial-lookup', component: FATSerialNumberComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'FAT-edit-cat', component: FATEditCategoriesComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'FAT-edit-checklist/:category', component: FATEditChecklistComponent, canActivate: [AreaGuard], data: { area: 'fat' }, canDeactivate: [UnsavedChangesGuard] },
  { path: 'FAT-add-checklist/:project/:phase', component: FATAddChecklistComponent, canActivate: [AreaGuard], data: { area: 'fat' }, canDeactivate: [UnsavedChangesGuard] },
  { path: 'FAT-phase-comments/:project/:phase', component: FATPhaseCommentsComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'FAT-pdf-select/:project/:phase', component: FatPdfSelectUnitsComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'FAT-pdf', component: FatPdfResultComponent, canActivate: [AreaGuard], data: { area: 'fat' } },
  { path: 'train-reg', component: TrainingLocationsComponent, canActivate: [AdminGuard] },
  { path: 'train-reg/:location', component: TrainingLocationComponent, canActivate: [AdminGuard] },
  { path: 'train-reg/:location/:username', component: TrainingUserComponent, canActivate: [AdminGuard] },
  { path: 'config-image-list', component: ConfigImageListComponent, canActivate: [AdminGuard] },
  { path: 'config-edit-cat', component: ConfigEditCategoriesComponent, canActivate: [AdminGuard] },
  { path: 'config-edit-checklist/:type', component: ConfigEditChecklistComponent, canActivate: [AdminGuard], canDeactivate: [UnsavedChangesGuard] },
  { path: 'config-admin', component: ConfigAdminComponent, canActivate: [AdminGuard] },
  { path: 'config-categories/:location', component: ConfigCategoriesComponent, canActivate: [LocationGuard] },
  { path: 'config-type/:location/:category', component: ConfigTypeComponent, canActivate: [LocationGuard] },
  { path: 'config-locations', component: ConfigLocationsComponent, canActivate: [AdminGuard] },
  { path: 'config-unit/:location/:category/:type', component: ConfigUnitComponent, canActivate: [LocationGuard] },
  { path: 'config-hardware-checklist/:location/:category/:type/:id', component: ConfigUnitFormComponent, canActivate: [LocationGuard], canDeactivate: [UnsavedChangesGuard] },
  { path: 'config-hardware-list', component: ConfigHardwareListComponent, canActivate: [AdminGuard] },
  { path: '**', component: NotFoundComponent }
];

@NgModule({
  declarations: [
    AppComponent,
    ReceivingTableComponent,
    ReceivingDetailTableComponent,
    HeaderComponent,
    SidenavComponent,
    FooterComponent,
    ProdSubassemblyTableComponent,
    ProdTableComponent,
    ProdComponentTableComponent,
    StockkeepingComponent,
    DialogBoxConfirmationComponent,
    DialogBoxShortageReportComponent,
    DialogBoxFaultyReportComponent,
    DialogBoxMessageComponent,
    ShippingDialogBoxConfirmationComponent,
    DialogBoxChangeLocationComponent,
    UnsavedChangesDialogComponent,
    GeneralDialogBoxComponent,
    LoginComponent,
    ResetPasswordComponent,
    MaxAmountDirective,
    ResizeColumnDirective,
    PurchaseOrderComponent,
    NotFoundComponent,
    FATUnitCatComponent,
    FATAddPhaseComponent,
    FATUnitEntryComponent,
    FilterPickerComponent,
    FATUnitChecklistComponent,
    TrainingLocationsComponent,
    TrainingLocationComponent,
    TrainingUserComponent,
    FATProjectListComponent,
    FATProjectPhaseComponent,
    FATUnitListComponent,
    FATAddUnitComponent,
    FATMoveUnitsComponent,
    FATSerialNumberComponent,
    FATEditCategoriesComponent,
    FATEditChecklistComponent,
    FATAddChecklistComponent,
    FATPhaseCommentsComponent,
    FATRestrictedAccess,
    FatPdfSelectUnitsComponent,
    FatPdfResultComponent,
    ConfigImageListComponent,
    ConfigEditCategoriesComponent,
    ConfigEditChecklistComponent,
    TableSortDirective,
    ConfigAdminComponent,
    ConfigCategoriesComponent,
    ConfigTypeComponent,
    ConfigRestrictedAccess,
    ConfigLocationsComponent,
    DialogBoxConfigLocationsComponent,
    HardwareTreeComponent,
    ConfigUnitComponent,
    ConfigUnitFormComponent,
    ListFiltersComponent,
    ConfigCatalogueDialogComponent,
    LocationProjectsComponent,
    InvalidFieldComponent,
    PcImageTreeComponent,
    ConfigHardwareListComponent,
    HardwareTypeListComponent,
    HomeComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FontAwesomeModule,
    MatMenuModule,
    MatSnackBarModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    ScrollingModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatSelectModule,
    MatSidenavModule,
    MatListModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    //FormControl,
    MatDialogModule,
    RouterModule.forRoot(routes),
    ErrorModule,
    ErrorHandlingModule,
    MatProgressSpinnerModule,
    MatGridListModule,
    MatCardModule,
    MatTreeModule,
    MatIconModule,
    MatButtonModule,
    MatAutocompleteModule,
    MatTabsModule
  ],
  exports: [RouterModule],
  providers: [{provide: APP_BASE_HREF, useValue: '/'}],
  bootstrap: [AppComponent],
})
export class AppModule {
  constructor(library: FaIconLibrary) {
    // Add an icon to the library for convenient access in other components
    library.addIcons(faPlus, faBoxOpen, faTools, faCubes, faUser, faChevronCircleLeft, faSave, faEnvelope, faAngleRight, faFileInvoice, faCheckSquare, faDumbbell, faPencilAlt, faCheck, faTimes, faSync, faTrash, faCogs, faDesktop, faChevronCircleRight, faChevronDown, faChevronRight, faHome, faWarehouse, faArrowRight, faSignOutAlt, faFileExport, faComments, faClipboardList, faSearch, faChevronUp, faFilter, faUsers);
  }
}
