import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRouteSnapshot, CanDeactivate, Router, RouterStateSnapshot } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DialogBoxConfirmationComponent } from '../dialog-box/confirmation/confirmation-dialog-box';

// A page that can have edits the user has not saved yet.
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

// Asks before leaving a page with unsaved edits, so a stray tap on Back doesn't silently throw work away.
@Injectable({ providedIn: 'root' })
export class UnsavedChangesGuard implements CanDeactivate<HasUnsavedChanges> {
  constructor(private dialog: MatDialog, private router: Router, private location: Location) {}

  canDeactivate(component: HasUnsavedChanges, _route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> | boolean {
    if (!component.hasUnsavedChanges()) {
      return true;
    }
    const navigation = this.router.getCurrentNavigation();
    const wentBack = !!navigation && navigation.trigger === 'popstate';
    return this.dialog.open(DialogBoxConfirmationComponent, {
      data: {
        title: 'Leave without saving?',
        message: 'You have changes that are not saved yet. If you leave this page they will be lost.',
        confirmLabel: 'Leave',
      },
    }).afterClosed().pipe(map(leave => {
      // Back has already moved the browser to the previous page's history entry, and the router would overwrite that
      // entry when the move is refused. Put this page back on top, so the next Back still lands on the previous page.
      if (!leave && wentBack) {
        this.location.go(state.url);
      }
      return !!leave;
    }));
  }
}
