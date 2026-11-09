import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ConfigService } from '../config.service';
import { matchesTerm } from '../config-view';

// The hardware types a location can configure in one category; opening one lists its units.
@Component({
  selector: 'webproject-config-type',
  templateUrl: './config-type.component.html'
})

export class ConfigTypeComponent implements OnInit, OnDestroy {

  location = '';
  category = '';
  term = '';
  private routeSub: Subscription;
  // The category's icon comes from the catalogue.
  readonly icon = () => (this.ConfigService.category(this.category) || { icon: 'box-open' }).icon;

  // The tiles are worked out again only when the types or the search change.
  private tilesFor: String[] | null = null;
  private tilesCount = -1;
  private tilesTerm = '';
  private cachedTiles: string[] = [];

  constructor(
    public ConfigService: ConfigService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.ConfigService.checkIfAdmin();
    // The page is reused when only the category in the address changes, so it follows the address.
    this.routeSub = this.route.paramMap.subscribe(params => {
      this.location = params.get('location') || '';
      this.category = params.get('category') || '';
      this.term = '';
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSub.unsubscribe();
  }

  load(): void {
    this.ConfigService.getLocationCategoryTypes(this.location, this.category);
    this.ConfigService.getCatalogue().subscribe();
  }

  getLocation(): string {
    return this.location;
  }

  getCategory(): string {
    return this.category;
  }

  get types(): String[] {
    return this.ConfigService.locationCategoryTypes;
  }

  get tiles(): string[] {
    const types = this.types;
    // The service fills the same array in place, so its length is checked as well as which array it is.
    if (this.tilesFor !== types || this.tilesCount !== types.length || this.tilesTerm !== this.term) {
      this.tilesFor = types;
      this.tilesCount = types.length;
      this.tilesTerm = this.term;
      this.cachedTiles = types.map(t => String(t)).filter(t => matchesTerm(t, this.term));
    }
    return this.cachedTiles;
  }

  setTerm(term: string): void {
    this.term = term;
  }

  trackByName(index: number, name: string): string {
    return name;
  }
}
