import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { IDashboardSummary } from '@webproject/data';
import { AuthInfoService } from '../auth/auth-info.service';
import { HomeService } from './home.service';

interface HomeCard {
  title: string;
  icon: string;
  link: string | any[];
  value?: number | null;  // undefined: no figure for this card; null: not loaded yet
  label: string;
  meta: string;
  warn?: boolean;
  progress?: number;      // 0-100, drawn as a bar
}

const ROLE_LABELS: { [role: string]: string } = { ADMIN: 'Administrator', OPERATOR: 'Operator', EXTUSER: 'External user' };

@Component({
  selector: 'webproject-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  name = localStorage.getItem('name');
  today = new Date();
  roleLabel: string;
  failed = false;

  warehouseCards: HomeCard[] = [];
  quickCards: HomeCard[] = [];

  private showWarehouse: boolean;
  private showFat: boolean;
  private isAdmin: boolean;
  private configRoute: any[] | null;

  constructor(private homeService: HomeService, authInfo: AuthInfoService) {
    const roles = authInfo.roles;
    this.isAdmin = authInfo.isAdmin();
    this.showWarehouse = authInfo.hasArea('warehouse');
    this.showFat = authInfo.hasArea('fat');
    this.configRoute = authInfo.configRoute();
    this.roleLabel = roles.map(r => ROLE_LABELS[r]).filter(l => l)[0] || '';
  }

  ngOnInit(): void {
    this.buildCards(null);
    this.load();
  }

  get greeting(): string {
    const hour = this.today.getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  }

  load(): void {
    this.failed = false;
    this.buildCards(null);
    this.homeService.getSummary().subscribe(
      (summary) => this.buildCards(summary),
      (error) => {
        this.failed = true;
        // A 401 goes to the global handler, which sends the user to the login page.
        if (error instanceof HttpErrorResponse && error.error && error.error.statusCode == 401) {
          throw error;
        }
      }
    );
  }

  // Cards show only for the areas the person holds. The summary has the same sections (the API leaves out the rest),
  // so a card appears as a placeholder while the summary loads (s is null) and with figures once it arrives.
  private buildCards(s: IDashboardSummary | null): void {
    const loading = s === null;
    const cards: HomeCard[] = [];
    if (this.showWarehouse && (loading || s.production)) {
      cards.push(
        {
          title: 'Production', icon: 'tools', link: '/prod-order',
          value: s ? s.production.open : null, label: 'open orders',
          meta: s ? `${s.production.inProgress} in progress · ${s.production.overdue} overdue` : '',
          warn: !!s && s.production.overdue > 0
        },
        {
          title: 'Orders', icon: 'file-invoice', link: '/orders',
          value: s ? s.orders.open : null, label: 'open orders',
          meta: s ? `${s.orders.overdue} overdue · ${s.orders.openLines} open lines` : '',
          warn: !!s && s.orders.overdue > 0
        },
        {
          title: 'Receiving', icon: 'box-open', link: '/receiving',
          value: s ? s.receiving.open : null, label: 'to receive',
          meta: s ? `${s.receiving.dueThisWeek} due this week · ${s.receiving.overdue} overdue` : '',
          warn: !!s && s.receiving.overdue > 0
        },
        {
          title: 'Inventory', icon: 'cubes', link: '/stockkeeping',
          value: s ? s.inventory.skus : null, label: 'items stocked',
          meta: s ? `${s.inventory.lowStock} low stock` : '',
          warn: !!s && s.inventory.lowStock > 0
        }
      );
    }
    this.warehouseCards = cards;

    const quick: HomeCard[] = [];
    if (this.configRoute) {
      quick.push({
        title: 'Config', icon: 'desktop', link: this.configRoute,
        label: this.isAdmin ? 'Locations, hardware and images' : 'Hardware checklists for your location',
        meta: ''
      });
    }
    if (this.showFat && (loading || s.fat)) {
      quick.push({
        title: 'FAT', icon: 'cogs', link: '/FAT-project-list',
        value: s ? s.fat.total : null, label: 'projects',
        meta: s ? `${s.fat.complete} complete, ${s.fat.inProgress} in progress` +
          (s.fat.attention.units ? ` · ${s.fat.attention.units} ${s.fat.attention.units === 1 ? 'unit' : 'units'} with failed checks` : '') : '',
        progress: s && s.fat.total ? Math.round((s.fat.complete / s.fat.total) * 100) : undefined,
        warn: !!s && s.fat.attention.units > 0
      });
    }
    if (this.isAdmin) {
      // Modules that are expired or were never done are the ones shown in red in the register.
      const t = s && s.training;
      const red = t ? t.expired + t.missing : null;
      quick.push({
        title: 'Training', icon: 'dumbbell', link: '/train-reg',
        value: red, label: 'modules need attention',
        meta: t ? (red || t.dueSoon
          ? `${t.expired} expired · ${t.missing} not done · ${t.dueSoon} due soon`
          : `All required training is in date for ${t.people} ${t.people === 1 ? 'person' : 'people'}`) : '',
        warn: !!t && red > 0
      });
    }
    this.quickCards = quick;
  }

  trackByTitle(index: number, card: HomeCard): string {
    return card.title;
  }
}
