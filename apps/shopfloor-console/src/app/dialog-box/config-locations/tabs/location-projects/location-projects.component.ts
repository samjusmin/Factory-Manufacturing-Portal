import { Component, Input, OnInit } from '@angular/core';
import { STOCK_PROJECT, cleanProjectCode } from '@webproject/data';

/**
 * "Projects" tab of the Edit Locations dialog: the project codes the location's units can be allocated to. STOCK is
 * built in (items not allocated to a project) and cannot be removed. The server refuses to remove a code a unit still
 * uses, and says so when the dialog is saved.
 */
@Component({
  selector: 'app-location-projects',
  templateUrl: './location-projects.component.html',
  styleUrls: ['./location-projects.component.css']
})
export class LocationProjectsComponent implements OnInit {

  @Input() locationData: any = {};

  readonly stock = STOCK_PROJECT;

  // The location's own project codes (STOCK is not in the list).
  projects: string[] = [];
  newCode = '';
  message = '';

  ngOnInit(): void {
    this.projects = ((this.locationData && this.locationData.projects) || [])
      .map(cleanProjectCode)
      .filter((code: string) => code && code !== STOCK_PROJECT);
  }

  add(): void {
    const code = cleanProjectCode(this.newCode);
    if (!code) {
      return;
    }
    if (code === STOCK_PROJECT) {
      this.message = `${STOCK_PROJECT} is built in, so every location already has it.`;
    } else if (this.projects.includes(code)) {
      this.message = `${code} is already a project here.`;
    } else {
      this.projects = [...this.projects, code];
      this.message = '';
    }
    this.newCode = '';
  }

  remove(code: string): void {
    this.projects = this.projects.filter(p => p !== code);
    this.message = '';
  }

  getFormattedProjects(): { location: string; projects: string[] } {
    // A code still being typed counts as added.
    if (cleanProjectCode(this.newCode)) {
      this.add();
    }
    return { location: this.locationData.location, projects: this.projects };
  }
}
