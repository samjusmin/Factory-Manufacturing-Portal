import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthInfoService } from '../auth/auth-info.service';

@Component({
    selector: 'webproject-sidenav',
    templateUrl: './sidenav.component.html',
    styleUrls: ['./sidenav.component.css']
})
export class SidenavComponent implements OnDestroy {
    username = localStorage.getItem('name');
    userrole = localStorage.getItem('role');

    // Config entry point for this user: the dashboard for admins, their own location for
    // other Config users, null (item hidden) for everyone else.
    configRoute: any[] | null;

    // Warehouse and FAT show only for people who hold a role in them (admins hold them all).
    canViewWarehouse: boolean;
    canViewFat: boolean;

    // The Training register is admin-only on the API, so only admins get a link to it.
    canViewTraining: boolean;

    warehouseOpen = false;
    private url: string;
    private sub: Subscription;

    private static readonly warehousePaths = ['/prod-order', '/orders', '/receiving', '/stockkeeping'];

    constructor(private router: Router, authInfo: AuthInfoService) {
        this.configRoute = authInfo.configRoute();
        this.canViewWarehouse = authInfo.hasArea('warehouse');
        this.canViewFat = authInfo.hasArea('fat');
        this.canViewTraining = authInfo.isAdmin();
        this.setUrl(router.url);
        this.sub = router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(event => this.setUrl((event as NavigationEnd).urlAfterRedirects));
    }

    ngOnDestroy(): void {
        this.sub.unsubscribe();
    }

    toggleWarehouse(): void {
        this.warehouseOpen = !this.warehouseOpen;
    }

    isHome(): boolean {
        return this.path === '/' || this.path === '';
    }

    // True for the page itself and anything beneath it, e.g. /prod-order/123.
    isActive(base: string): boolean {
        return this.path === base || this.path.startsWith(base + '/');
    }

    get warehouseActive(): boolean {
        return SidenavComponent.warehousePaths.some(p => this.isActive(p));
    }

    get configActive(): boolean {
        return this.path.startsWith('/config-');
    }

    get fatActive(): boolean {
        return this.path.startsWith('/FAT-');
    }

    private get path(): string {
        return this.url.split(/[?#]/)[0];
    }

    // Entering a Warehouse page expands its group; leaving never collapses it on its own.
    private setUrl(url: string): void {
        this.url = url;
        if (this.warehouseActive) {
            this.warehouseOpen = true;
        }
    }
}
