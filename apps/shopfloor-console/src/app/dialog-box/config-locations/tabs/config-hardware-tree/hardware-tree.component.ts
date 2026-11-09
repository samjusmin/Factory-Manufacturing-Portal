import { Component, Input, OnInit } from '@angular/core';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { IConfigHardware } from '@webproject/data';
import { ConfigService } from '../../../../config/config.service';

interface HardwareNode {
  name: string;
  children?: HardwareNode[];
}

/**
 * "Config Access" tab of the Edit Locations dialog: which hardware types (grouped by category) a location may
 * configure. The categories and types come from the hardware catalogue (Config > Item Checklists).
 */
@Component({
  selector: 'app-hardware-tree',
  templateUrl: './hardware-tree.component.html',
  styleUrls: ['./hardware-tree.component.css']
})
export class HardwareTreeComponent implements OnInit {
    @Input()
    locationData: any = {};
    treeControl = new NestedTreeControl<HardwareNode>(node => node.children);
    dataSource = new MatTreeNestedDataSource<HardwareNode>();
    faChevronRight = faChevronRight;
    faChevronDown = faChevronDown;

    loaded = false;

    // The hardware types (by name; a type belongs to one category) the location may configure.
    selectedTypes = new Set<string>();

    constructor(
        public ConfigService: ConfigService,
    ) {}

    ngOnInit() {
        ((this.locationData && this.locationData['item_access']) || []).forEach((entry: IConfigHardware) =>
            (entry.hardware_type || []).forEach(type => this.selectedTypes.add(type)));

        this.ConfigService.getCatalogue().subscribe(catalogue => {
            this.dataSource.data = catalogue.categories
                .filter(category => category.types.length)
                .map(category => ({ name: category.name, children: category.types.map(name => ({ name })) }));
            this.loaded = true;
        });
    }

    hasChild = (_: number, node: HardwareNode) => !!node.children && node.children.length > 0;

    isSelected(node: HardwareNode): boolean {
        return this.selectedTypes.has(node.name);
    }

    descendantAllSelected(node: HardwareNode): boolean {
        return !!node.children && node.children.length > 0 && node.children.every(child => this.isSelected(child));
    }

    descendantPartiallySelected(node: HardwareNode): boolean {
        return !!node.children && node.children.some(child => this.isSelected(child)) && !this.descendantAllSelected(node);
    }

    // A category's box selects or clears all of its types.
    toggleNodeSelection(node: HardwareNode): void {
        const select = !this.descendantAllSelected(node);
        node.children.forEach(child => select ? this.selectedTypes.add(child.name) : this.selectedTypes.delete(child.name));
    }

    toggleLeafNode(node: HardwareNode): void {
        if (this.isSelected(node)) {
            this.selectedTypes.delete(node.name);
        } else {
            this.selectedTypes.add(node.name);
        }
    }

    // The access to save: each category with at least one selected type, in the catalogue's order.
    getFormattedLocationAccess(): { location: string; item_access: IConfigHardware[] } {
        // A type the catalogue no longer lists would be refused by the server, so the tree's own types are the only ones kept.
        const item_access = this.dataSource.data
            .map(category => ({
                hardware_category: category.name,
                hardware_type: category.children.filter(child => this.isSelected(child)).map(child => child.name),
            }))
            .filter(entry => entry.hardware_type.length);
        return { location: this.locationData['location'], item_access };
    }
}
