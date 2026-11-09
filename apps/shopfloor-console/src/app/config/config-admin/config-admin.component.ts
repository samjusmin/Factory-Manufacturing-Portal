import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { IConfigLocation } from '@webproject/data';
import { ConfigService } from '../config.service';
import { locationSummary, matchesTerm } from '../config-view';

interface ILocationTile {
  name: string;
  meta: string;
}

// The Config home page (administrators): a tile for every location, and the lists every location draws from.
@Component({
  selector: 'webproject-config-admin',
  templateUrl: './config-admin.component.html'
})

export class ConfigAdminComponent implements OnInit {

  term = '';

  // The tiles are worked out again only when the locations or the search change.
  private tilesFor: IConfigLocation[] | null = null;
  private tilesTerm = '';
  private cachedTiles: ILocationTile[] = [];

  constructor(
    public dialog: MatDialog,
    public ConfigService: ConfigService,
  ) {}

  ngOnInit(): void {
    this.ConfigService.checkIfAdmin();
    this.load();
  }

  load(): void {
    this.ConfigService.getAllLocations();
  }

  get locations(): IConfigLocation[] {
    return this.ConfigService.locationDatasource.data;
  }

  get tiles(): ILocationTile[] {
    if (this.tilesFor !== this.locations || this.tilesTerm !== this.term) {
      this.tilesFor = this.locations;
      this.tilesTerm = this.term;
      this.cachedTiles = this.locations
        .filter(l => matchesTerm(l.location, this.term))
        .map(l => ({ name: l.location, meta: locationSummary(l) }));
    }
    return this.cachedTiles;
  }

  setTerm(term: string): void {
    this.term = term;
  }

  trackByName(index: number, tile: ILocationTile): string {
    return tile.name;
  }
}
