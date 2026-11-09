import { Component, OnInit } from '@angular/core';
import { FATUnitComments } from '@webproject/data';
import { FATProjectService } from '../fat-project.service';

@Component({
  selector: 'webproject-fat-phase-comments',
  templateUrl: './fat-phase-comments.component.html',
  styleUrls: ['./fat-phase-comments.component.css']
})

export class FATPhaseCommentsComponent implements OnInit {

  // What the user has typed in the search box.
  search = '';

  constructor(
    public FATProjectService: FATProjectService,
  ) {
    FATProjectService.isLoaded = false;
    FATProjectService.showError = false;
  }

  ngOnInit() {
    this.FATProjectService.checkIfAdmin();
    this.FATProjectService.getPhaseName(this.getProject(), this.getPhase());
    this.reload();
  }

  reload() {
    this.FATProjectService.getAllUnitComments(this.getProject(), this.getPhase());
  }

  getProject() {
    const routePaths = this.FATProjectService.router.url.split("/", 3);
    return decodeURIComponent(routePaths[2]);
  }

  getPhase() {
    const routePaths = this.FATProjectService.router.url.split("/", 4);
    return decodeURIComponent(routePaths[3]);
  }

  // Units that have a note (the others have nothing to show here).
  get withNotes(): FATUnitComments[] {
    return (this.FATProjectService.allUnitsCommentSource || []).filter(unit => (unit.comment || '').trim() !== '');
  }

  // The notes that match the search, which looks at the unit number, serial number and the note itself.
  get shown(): FATUnitComments[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.withNotes;
    }
    return this.withNotes.filter(unit =>
      [unit.doc_no, unit.unit_no, unit.comment].some(value => (value || '').toLowerCase().indexOf(term) !== -1));
  }

  get totalUnits(): number {
    return (this.FATProjectService.allUnitsCommentSource || []).length;
  }

  trackUnit(index: number, unit: FATUnitComments) {
    return unit.doc_no;
  }
}
