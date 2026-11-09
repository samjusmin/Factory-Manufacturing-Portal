import { of } from 'rxjs';
import { HardwareTreeComponent } from './hardware-tree.component';

const catalogue = {
  categories: [
    { name: 'PC', icon: 'desktop', uses_image: true, parts: [], types: ['Kiosk A PC', 'Bio PC'] },
    { name: 'Printer', icon: 'file-invoice', uses_image: false, parts: [], types: [] },
    { name: 'Network Switch', icon: 'cogs', uses_image: false, parts: [], types: ['5-port D-Link'] },
  ],
};

function build(itemAccess: any[] = []) {
  const component = new HardwareTreeComponent({ getCatalogue: () => of(catalogue) } as any);
  component.locationData = { location: 'Meridian HQ', item_access: itemAccess };
  component.ngOnInit();
  return component;
}

describe('HardwareTreeComponent', () => {
  it('builds the tree from the catalogue, leaving out categories with no types', () => {
    const component = build();
    expect(component.loaded).toBe(true);
    expect(component.dataSource.data.map((c) => c.name)).toEqual(['PC', 'Network Switch']);
    expect(component.dataSource.data[0].children.map((t) => t.name)).toEqual(['Kiosk A PC', 'Bio PC']);
  });

  it('starts with the types the location already has ticked', () => {
    const component = build([{ hardware_category: 'PC', hardware_type: ['Kiosk A PC'] }]);
    const [pc, sw] = component.dataSource.data;
    expect(component.isSelected(pc.children[0])).toBe(true);
    expect(component.isSelected(pc.children[1])).toBe(false);
    expect(component.descendantPartiallySelected(pc)).toBe(true);
    expect(component.descendantAllSelected(pc)).toBe(false);
    expect(component.descendantAllSelected(sw)).toBe(false);
  });

  it('shows a category ticked only when every one of its types is', () => {
    const component = build([{ hardware_category: 'PC', hardware_type: ['Kiosk A PC', 'Bio PC'] }]);
    const pc = component.dataSource.data[0];
    expect(component.descendantAllSelected(pc)).toBe(true);
    expect(component.descendantPartiallySelected(pc)).toBe(false);
  });

  it('ticks or clears every type of a category from the category\'s box', () => {
    const component = build();
    const pc = component.dataSource.data[0];
    component.toggleNodeSelection(pc);
    expect(component.descendantAllSelected(pc)).toBe(true);
    component.toggleNodeSelection(pc);
    expect(component.descendantAllSelected(pc)).toBe(false);
    expect(component.descendantPartiallySelected(pc)).toBe(false);
  });

  it('ticks and clears a single type', () => {
    const component = build();
    const type = component.dataSource.data[1].children[0];
    component.toggleLeafNode(type);
    expect(component.isSelected(type)).toBe(true);
    component.toggleLeafNode(type);
    expect(component.isSelected(type)).toBe(false);
  });

  it('reports each category that has a ticked type, in the catalogue\'s order', () => {
    const component = build([{ hardware_category: 'PC', hardware_type: ['Bio PC'] }]);
    component.toggleLeafNode(component.dataSource.data[1].children[0]);
    expect(component.getFormattedLocationAccess()).toEqual({
      location: 'Meridian HQ',
      item_access: [
        { hardware_category: 'PC', hardware_type: ['Bio PC'] },
        { hardware_category: 'Network Switch', hardware_type: ['5-port D-Link'] },
      ],
    });
  });

  it('reports no category when nothing is ticked', () => {
    expect(build().getFormattedLocationAccess().item_access).toEqual([]);
  });
});
