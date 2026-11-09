// What training exists, and what each role (area of the app) requires. One place, shared by the API and the app, so the
// register, the access rules and the Home card all agree. To change what a role requires, edit TRAINING_REQUIREMENTS.

// The areas of the app a user can hold a role in. A role gives access to that part of the app and requires training.
export type TrainingArea = 'warehouse' | 'config' | 'fat';
export const TRAINING_AREAS: TrainingArea[] = ['warehouse', 'config', 'fat'];

export const TRAINING_AREA_LABELS: { [area: string]: string } = {
  warehouse: 'Warehouse',
  config: 'Config',
  fat: 'FAT',
};

export function isTrainingArea(value: any): value is TrainingArea {
  return TRAINING_AREAS.indexOf(value) > -1;
}

// Every module is renewed this many years after it was completed.
export const TRAINING_VALIDITY_YEARS = 2;
// A module renewing within this many days is flagged "due soon" (amber) before it expires (red).
export const TRAINING_DUE_SOON_DAYS = 60;

export interface ITrainingModuleInfo {
  name: string;
  category: string;
}

// All the modules. The category is for grouping and display only.
export const TRAINING_MODULES: ITrainingModuleInfo[] = [
  // Assembly
  { name: 'Steel Jig Assembly', category: 'Assembly' },
  { name: 'Biometric/Bagtag Camera', category: 'Assembly' },
  { name: 'Led Box', category: 'Assembly' },
  { name: 'Real Sense', category: 'Assembly' },
  { name: 'Touchless', category: 'Assembly' },
  { name: 'Unit Y Standard', category: 'Assembly' },
  { name: 'Unit Y Hybrid', category: 'Assembly' },
  { name: 'Hybrid Compact', category: 'Assembly' },
  { name: 'Kiosk B', category: 'Assembly' },
  { name: 'Conveyors', category: 'Assembly' },
  { name: 'MCP', category: 'Assembly' },
  // Internal configuration
  { name: 'Kiosk A PC', category: 'Internal Config' },
  { name: 'Unit X1 PC', category: 'Internal Config' },
  { name: 'Unit X2 PC', category: 'Internal Config' },
  { name: 'Bagtag PC', category: 'Internal Config' },
  { name: 'Bio PC', category: 'Internal Config' },
  { name: 'Switch Config', category: 'Internal Config' },
  { name: 'Unit W1 Config', category: 'Internal Config' },
  { name: 'Light Grid Config', category: 'Internal Config' },
  { name: 'Printer Config', category: 'Internal Config' },
  // Site commissioning (factory and site acceptance)
  { name: 'Unit Y Commissioning', category: 'Site Commissioning' },
  { name: 'Unit Y Plus Commissioning', category: 'Site Commissioning' },
  { name: 'Unit Y Plus Commissioning with Unit X2', category: 'Site Commissioning' },
  { name: 'Unit Y Compact Commissioning', category: 'Site Commissioning' },
  { name: 'Kiosk Commissioning', category: 'Site Commissioning' },
  { name: 'Kiosk Lite Commissioning', category: 'Site Commissioning' },
  { name: 'Unit W2 Commissioning', category: 'Site Commissioning' },
  { name: 'Unit W2 Variant Commissioning', category: 'Site Commissioning' },
  { name: 'Unit W3 Commissioning', category: 'Site Commissioning' },
  { name: 'Unit X1 Commissioning', category: 'Site Commissioning' },
  // Warehouse
  { name: 'Picking/Packing', category: 'Warehouse' },
  { name: 'Walkie Stacker & Pallet Jack', category: 'Warehouse' },
  { name: 'Internal Receiving Compliance', category: 'Warehouse' },
  { name: 'Warehouse Safety Induction', category: 'Warehouse' },
  { name: 'Logistics', category: 'Warehouse' },
  { name: 'RMA Register', category: 'Warehouse' },
  { name: 'Stock Management', category: 'Warehouse' },
  // Data
  { name: 'Integration Platform', category: 'Data Integration' },
];

// The modules each role requires. A user holding several roles must complete the modules of every role they hold; a
// module that appears in two of them is only needed once. Modules in no list (such as Logistics) can still be
// recorded, they are just not required of anyone.
export const TRAINING_REQUIREMENTS: { [area in TrainingArea]: string[] } = {
  warehouse: [
    'Warehouse Safety Induction',
    'Walkie Stacker & Pallet Jack',
    'Internal Receiving Compliance',
    'Picking/Packing',
    'Stock Management',
    'RMA Register',
  ],
  config: [
    'Kiosk A PC',
    'Unit X1 PC',
    'Unit X2 PC',
    'Bagtag PC',
    'Bio PC',
    'Switch Config',
    'Unit W1 Config',
    'Light Grid Config',
    'Printer Config',
  ],
  fat: [
    'Unit X1 Commissioning',
    'Kiosk Commissioning',
    'Unit Y Commissioning',
    'Unit W2 Commissioning',
  ],
};

export function trainingModuleInfo(name: string): ITrainingModuleInfo | undefined {
  return TRAINING_MODULES.find(m => m.name === name);
}

export function isTrainingModule(name: any): boolean {
  return TRAINING_MODULES.some(m => m.name === name);
}
