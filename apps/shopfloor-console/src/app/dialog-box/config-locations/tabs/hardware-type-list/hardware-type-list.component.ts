import { Component, Input, OnInit } from '@angular/core';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { ConfigService } from '../../../../config/config.service';

interface HardwareItem {
  _id: string;
  name: string;
  config_type: string[];
}

interface HardwareNode {
  name: string;
  hardwareId?: string;
  children?: HardwareNode[];
}

/**
 * "Hardware Access" tab of the Config Locations dialog: which hardware models (Config > Hardware List) a
 * location may choose from, e.g. the PC Model dropdown when it adds a PC unit. Shown as an expandable tree
 * of config type > hardware model, like the Config Access and PC Image Access tabs.
 */
@Component({
  selector: 'app-hardware-type-list',
  templateUrl: './hardware-type-list.component.html',
  styleUrls: ['./hardware-type-list.component.css']
})
export class HardwareTypeListComponent implements OnInit {

  @Input() locationData: any = {};

  treeControl = new NestedTreeControl<HardwareNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<HardwareNode>();

  faChevronRight = faChevronRight;
  faChevronDown = faChevronDown;

  loaded = false;

  selectedHardware = new Set<string>();

  constructor(
    public ConfigService: ConfigService
  ) {}

  ngOnInit(): void {
    this.selectedHardware = new Set(this.locationData?.hardware_access ?? []);
    this.loadHardware();
  }

  loadHardware(): void {
    this.ConfigService.getHardwareTypeList().subscribe((data: HardwareItem[]) => {
      const byCategory = new Map<string, HardwareNode[]>();
      data.forEach((hardware) => {
        const categories = hardware.config_type && hardware.config_type.length ? hardware.config_type : ['Other'];
        categories.forEach((category) => {
          if (!byCategory.has(category)) {
            byCategory.set(category, []);
          }
          byCategory.get(category).push({ name: hardware.name, hardwareId: hardware._id });
        });
      });

      this.dataSource.data = Array.from(byCategory.entries())
        .map(([name, children]) => ({
          name,
          children: children.sort((a, b) => a.name.localeCompare(b.name))
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.loaded = true;
    });
  }

  hasChild = (_: number, node: HardwareNode) => !!node.children && node.children.length > 0;

  isSelected(node: HardwareNode): boolean {
    return this.selectedHardware.has(node.hardwareId);
  }

  toggleLeafNode(node: HardwareNode): void {
    if (this.isSelected(node)) {
      this.selectedHardware.delete(node.hardwareId);
    } else {
      this.selectedHardware.add(node.hardwareId);
    }
  }

  descendantAllSelected(node: HardwareNode): boolean {
    return node.children.length > 0 && node.children.every(child => this.isSelected(child));
  }

  descendantPartiallySelected(node: HardwareNode): boolean {
    return node.children.some(child => this.isSelected(child)) && !this.descendantAllSelected(node);
  }

  toggleNodeSelection(node: HardwareNode): void {
    const select = !this.descendantAllSelected(node);
    node.children.forEach(child => {
      if (select) {
        this.selectedHardware.add(child.hardwareId);
      } else {
        this.selectedHardware.delete(child.hardwareId);
      }
    });
  }

  getSelectedHardwareIds(): string[] {
    return Array.from(this.selectedHardware);
  }

  getFormattedHardwareAccess() {
    return {
      location: this.locationData.location,
      hardware_access: this.getSelectedHardwareIds()
    };
  }

}
