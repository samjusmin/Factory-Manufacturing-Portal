import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { TrainingArea } from '@webproject/data';
import { AuthInfoService } from './auth-info.service';

// Where a non-admin goes when they try a Config page they may not open.
function ownConfigOrHome(router: Router, authInfo: AuthInfoService): UrlTree {
  const route = authInfo.configRoute();
  return router.createUrlTree(route || ['/']);
}

// Admin-only Config pages (dashboard, locations, hardware list, image list).
@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private authInfo: AuthInfoService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    return this.authInfo.isAdmin() || ownConfigOrHome(this.router, this.authInfo);
  }
}

// Config pages under a `:location` route param: admins may open any location, other users
// only their own.
@Injectable({
  providedIn: 'root'
})
export class LocationGuard implements CanActivate {
  constructor(private authInfo: AuthInfoService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (this.authInfo.isAdmin()) {
      return true;
    }
    const location = route.paramMap.get('location');
    if (this.authInfo.hasLocationConfigAccess() && this.authInfo.userLocations().includes(location)) {
      return true;
    }
    return ownConfigOrHome(this.router, this.authInfo);
  }
}

// Pages that belong to one part of the app (Warehouse, Config or FAT). The route says which in `data: { area }`.
// Admins can open every area; anyone else needs a role in it. The API refuses the same requests.
@Injectable({
  providedIn: 'root'
})
export class AreaGuard implements CanActivate {
  constructor(private authInfo: AuthInfoService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const area = route.data && route.data.area as TrainingArea;
    return !area || this.authInfo.hasArea(area) || this.router.createUrlTree(['/']);
  }
}
