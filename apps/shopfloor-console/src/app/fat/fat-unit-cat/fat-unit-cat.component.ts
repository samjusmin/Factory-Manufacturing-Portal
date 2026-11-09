import { Component, OnInit } from '@angular/core';
import { FATProjectService } from '../fat-project.service';
import { FATcategory, FATState, IFatCheckSummary, IOutstandingCheck, fatState } from '@webproject/data';
import { MatDialog } from '@angular/material/dialog';
import { DialogBoxConfirmationComponent } from '../../dialog-box/confirmation/confirmation-dialog-box';

@Component({
  selector: 'webproject-fat-unit-cat',
  templateUrl: './fat-unit-cat.component.html',
  styleUrls: ['./fat-unit-cat.component.css']
})

export class FATUnitCatComponent implements OnInit {

  categories =  new Array<FATcategory>();

  constructor(
    public FATProjectService: FATProjectService,
    public dialog: MatDialog,
  ) {
    FATProjectService.showError = false;
    FATProjectService.isLoaded = false;
    FATProjectService.notCompany = false;
  }

  editable = false;
  // The checks still to do on this unit (failed ones first). Null until it has loaded, or if it could not be.
  summary: IFatCheckSummary | null = null;
  showAllItems = false;
  readonly itemLimit = 8;
  // Where the notes are: '' (nothing to say), 'saving', 'saved' or 'failed'.
  noteStatus: '' | 'saving' | 'saved' | 'failed' = '';
  private noteTimer: any;

  async ngOnInit() {
    this.FATProjectService.checkIfAdmin();
    const project = this.getProject();
    const phase = this.getPhase();
    const unit = this.getUnit();

    this.categories = await this.FATProjectService.getCategories(project, phase, unit);
    this.FATProjectService.getPhaseName(project, phase);
    await this.FATProjectService.getUnitComments(project, phase, unit);
    this.loadSummary();
  }

  // Not essential to the page, so a failure just leaves the list out.
  loadSummary() {
    this.FATProjectService.getUnitOutstanding(this.getProject(), this.getPhase(), this.getUnit()).subscribe(
      (summary) => this.summary = summary,
      () => this.summary = null
    );
  }

  get shownItems(): IOutstandingCheck[] {
    const items = this.summary ? this.summary.items : [];
    return this.showAllItems ? items : items.slice(0, this.itemLimit);
  }

  getProject() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 5);
    return routePaths[2].replace(/\%20/g, " ");
  }

  getPhase() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 5);
    let phase = routePaths[3];
    return phase.replace(/\%20/g, " ");
  }

  getUnit() {
    const routeURL = this.FATProjectService.router.url;
    const routePaths = routeURL.split("/", 5);
    return routePaths[4].replace(/\%20/g, " ");
  }

  getEditable() {
    return this.editable;
  }

  toggleEditable() {
    this.editable = !this.editable;
  }

  stateOf(progress: number): FATState {
    return fatState(progress);
  }

  stateClass(progress: number): string {
    return 'state-' + fatState(progress).toLowerCase().split(' ').join('-');
  }

  // How many categories are finished, for the summary at the top of the page.
  get completeCount(): number {
    return (this.FATProjectService.categorysource || []).filter(c => fatState(c.progress) === 'Complete').length;
  }

  get overallProgress(): number {
    const cats = this.FATProjectService.categorysource || [];
    if (!cats.length) {
      return 0;
    }
    return Math.round(cats.reduce((sum, c) => sum + (c.progress || 0), 0) / cats.length);
  }

  // Deleting a category removes its checks and progress, so ask first and refresh only once the server has answered.
  removeCategory(deleteCategory: any) {
    const dialogRef = this.dialog.open(DialogBoxConfirmationComponent, {
      data: {
        title: 'Delete category?',
        message: 'Delete "' + deleteCategory + '" from ' + this.getUnit() + '? Its checks and progress will be removed and this cannot be undone.',
        confirmLabel: 'Delete',
      },
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) {
        return;
      }
      const remove = {
        project: this.getProject(),
        phase: this.getPhase(),
        unit: this.getUnit(),
        category: deleteCategory
      };
      this.FATProjectService.removeCategory(remove).subscribe(
        () => {
          this.FATProjectService.getCategories(this.getProject(), this.getPhase(), this.getUnit());
          this.loadSummary();
        },
        (error) => { throw error; }
      );
    });
  }

  saveChanges() {
    if (this.noteStatus === 'saving') {
      return;
    }
    clearTimeout(this.noteTimer);
    this.noteStatus = 'saving';
    const comment = String(this.FATProjectService.commentSource || '').trim();
    this.FATProjectService.saveUnitComment(this.getProject(), this.getPhase(), this.getUnit(), comment).subscribe(
      () => {
        this.noteStatus = 'saved';
        this.noteTimer = setTimeout(() => this.noteStatus = '', 3000);
      },
      (error) => {
        this.noteStatus = 'failed';
        throw error;
      }
    );
  }
}
