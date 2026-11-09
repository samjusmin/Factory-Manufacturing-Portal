import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConfigService } from '../config.service';
import { categorySummary } from '../config-view';

interface ICategoryTile {
  name: string;
  icon: string;
  meta: string;
}

// The hardware categories (PC, Network Switch...) a location can configure.
@Component({
  selector: 'webproject-config-categories',
  templateUrl: './config-categories.component.html'
})

export class ConfigCategoriesComponent implements OnInit, OnDestroy {

  location = '';
  private routeSub: Subscription;

  // The tiles are worked out again only when the categories arrive.
  private tilesFor: String[] | null = null;
  private tilesCount = -1;
  private tilesCatalogue: any = null;
  private cachedTiles: ICategoryTile[] = [];

  constructor(
    public ConfigService: ConfigService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.ConfigService.checkIfAdmin();
    // The page is reused when only the location in the address changes, so it follows the address.
    this.routeSub = this.route.paramMap.subscribe(params => {
      this.location = params.get('location') || '';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  load(): void {
    this.ConfigService.getLocationCategories(this.location);
    // The icon of each category comes from the catalogue.
    this.ConfigService.getCatalogue().subscribe();
  }

  getLocation(): string {
    return this.location;
  }

  get tiles(): ICategoryTile[] {
    const categories = this.ConfigService.locationCategories;
    // The service fills the same array in place, so its length is checked as well as which array it is.
    if (this.tilesFor !== categories || this.tilesCount !== categories.length || this.tilesCatalogue !== this.ConfigService.catalogue) {
      this.tilesFor = categories;
      this.tilesCount = categories.length;
      this.tilesCatalogue = this.ConfigService.catalogue;
      const entry = this.ConfigService.locationDatasource.data.find(l => l.location === this.location);
      this.cachedTiles = categories.map(c => ({ name: String(c), icon: (this.ConfigService.category(String(c)) || { icon: 'box-open' }).icon, meta: categorySummary(entry, String(c)) }));
    }
    return this.cachedTiles;
  }

  trackByName(index: number, tile: ICategoryTile): string {
    return tile.name;
  }
}
