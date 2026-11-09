import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { SelectionModel } from '@angular/cdk/collections';
import { faChevronRight, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { ConfigService } from '../../../../config/config.service';
import { PcImage, PcImageNode } from '@webproject/data';

@Component({
  selector: 'app-pc-image-tree',
  templateUrl: './pc-image-tree.component.html',
  styleUrls: ['./pc-image-tree.component.css']
})
export class PcImageTreeComponent implements OnInit {

  @Input() locationData: any = {};

  treeControl = new NestedTreeControl<PcImageNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<PcImageNode>();

  checklistSelection = new SelectionModel<PcImageNode>(true);

  faChevronRight = faChevronRight;
  faChevronDown = faChevronDown;

  imageList: PcImage[] = [];

  constructor(
    private http: HttpClient,
    public ConfigService: ConfigService,
  ) {}

  ngOnInit() {
    console.log('Processing PC image tree');
    console.log('LOCATIONDATA:', this.locationData);

    this.ConfigService.getImageTree()
    .subscribe((data: any) => {

        this.dataSource.data = data;

        this.applyPreselectedImages();

    });
  }

//   buildTree(images: PcImage[]): PcImageNode[] {

//     const grouped = new Map<string, PcImage[]>();

//     images.forEach(image => {
//         if (!grouped.has(image.pc_type)) {
//             grouped.set(image.pc_type, []);
//         }
//         grouped.get(image.pc_type)?.push(image);
//     });

//     return Array.from(grouped.entries()).map(([pcType, imageList]) => ({
//         name: pcType,
//         children: imageList.map(image => ({
//             name: image.name,
//             imageId: image._id
//         }))
//     }));
//   }

    applyPreselectedImages(): void {

        const selectedIds = this.locationData?.image_access ?? [];
        const selectedNodes: PcImageNode[] = [];

        this.dataSource.data.forEach(category => {
            category.children?.forEach(child => {
                if (
                    child.imageId &&
                    selectedIds.includes(child.imageId)
                ) {
                    selectedNodes.push(child);
                }
            });
        });

        this.checklistSelection =
            new SelectionModel<PcImageNode>(true, selectedNodes);
    }

  hasChild = (_: number, node: PcImageNode) => {
    return !!node.children && node.children.length > 0;
  };

  isLeafNode(node: PcImageNode): boolean {
    return !node.children || node.children.length === 0;
  }

  toggleLeafNode(node: PcImageNode): void {
    if (!this.isLeafNode(node)) {
      return;
    }

    this.checklistSelection.toggle(node);

    console.log('Selected image nodes:', this.checklistSelection.selected);
    console.log('Selected image IDs:', this.getSelectedImageIds());
  }

  getSelectedImageIds(): string[] {
    return this.checklistSelection.selected
      .filter(node => !!node.imageId)
      .map(node => node.imageId!);
  }

  getFormattedImageAccess(): any {
    return {
      location: this.locationData['location'],
      image_access: this.getSelectedImageIds()
    };
  }
  
}