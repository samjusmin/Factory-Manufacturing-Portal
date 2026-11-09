import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ITrainingLocation, TRAINING_VALIDITY_YEARS } from '@webproject/data';
import { ILocationCard, IPeopleTotals, distinctPeople, locationCard, peopleTotals } from '../training-view';
import { TrainingService } from '../training.service';

// The Training register's first page: one card per location with how its people are doing. Opening a card lists the
// people there.
@Component({
  selector: 'webproject-training-locations',
  templateUrl: './training-locations.component.html',
  styleUrls: ['./training-locations.component.css']
})
export class TrainingLocationsComponent implements OnInit {

  readonly validityYears = TRAINING_VALIDITY_YEARS;

  loaded = false;
  failed = false;
  term = '';
  attentionOnly = false;

  // Worked out when the data arrives or a filter changes, not on every screen update.
  cards: ILocationCard[] = [];
  visible: ILocationCard[] = [];
  totals: IPeopleTotals = peopleTotals([]);

  constructor(private training: TrainingService, private router: Router) { }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.failed = false;
    this.training.locations().subscribe(
      (locations) => this.show(locations),
      (error) => {
        this.failed = true;
        this.loaded = true;
        // A 401 goes to the global handler, which sends the user to the login page.
        if (error instanceof HttpErrorResponse && error.error && error.error.statusCode == 401) {
          throw error;
        }
      }
    );
  }

  private show(locations: ITrainingLocation[]): void {
    this.cards = locations.map(locationCard);
    this.totals = peopleTotals(distinctPeople(locations));
    this.loaded = true;
    this.applyFilters();
  }

  setTerm(term: string): void {
    this.term = term;
    this.applyFilters();
  }

  toggleAttention(): void {
    this.attentionOnly = !this.attentionOnly;
    this.applyFilters();
  }

  // A search matches a location's name, or the name or username of anyone registered there.
  private applyFilters(): void {
    const term = this.term.trim().toLowerCase();
    this.visible = this.cards.filter(card =>
      (!this.attentionOnly || card.totals.attention > 0) &&
      (!term || card.location.toLowerCase().includes(term) ||
        card.users.some(u => u.name.toLowerCase().includes(term) || u.username.toLowerCase().includes(term))));
  }

  get attentionCount(): number {
    return this.cards.filter(c => c.totals.attention > 0).length;
  }

  open(card: ILocationCard): void {
    this.router.navigate(['/train-reg', card.location]);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  trackByLocation(index: number, card: ILocationCard): string {
    return card.location;
  }
}
